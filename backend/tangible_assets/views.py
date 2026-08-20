from datetime import date, datetime
from decimal import Decimal

from django.db import transaction as db_transaction
from django.db.models import F, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from Accounts.models import Account, CashBalance, Currency, Security
from Currency.services import MissingExchangeRate, convert_amount
from Transactions.models import TradeDetail, Transaction
from Transactions.serializers import TransactionReadSerializer

from .models import TangibleAsset, TangibleAssetValuation, Unit
from .serializers import (
    TangibleAssetSerializer,
    TangibleAssetValuationSerializer,
    UnitSerializer,
)


def _decimal(value):
    return Decimal(str(value))


def _date(value, field="date"):
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise ValueError(f"{field} must use YYYY-MM-DD.")


def _assets_queryset(user):
    return (
        TangibleAsset.objects.filter(user=user)
        .select_related("currency", "unit")
        .prefetch_related("valuations")
    )


def _serializer_context(request):
    return {"request": request, "today": timezone.localdate()}


def _asset_current_value(asset, today):
    valuation = next(
        (row for row in asset.valuations.all() if row.date <= today), None
    )
    return valuation.value if valuation else asset.acquisition_cost


def _summary(assets, currency):
    today = timezone.localdate()
    totals = {}
    total = Decimal("0")
    for asset in assets:
        if asset.status != "active":
            continue
        value = _asset_current_value(asset, today)
        try:
            converted = convert_amount(
                value, asset.currency.code, currency, None
            )
        except MissingExchangeRate:
            raise
        total += converted
        totals[asset.asset_type] = (
            totals.get(asset.asset_type, Decimal("0")) + converted
        )
    labels = dict(TangibleAsset.ASSET_TYPE_CHOICES)
    return {
        "currency": currency,
        "total": float(total.quantize(Decimal("0.01"))),
        "by_type": [
            {
                "asset_type": key,
                "label": labels[key],
                "amount": float(value.quantize(Decimal("0.01"))),
            }
            for key, value in sorted(totals.items())
        ],
    }


def _create_valuation(
    asset, value, valuation_date, source="acquisition", notes=""
):
    valuation = TangibleAssetValuation(
        asset=asset,
        date=valuation_date,
        value=value,
        source=source,
        notes=notes,
    )
    valuation.full_clean()
    valuation.save()
    return valuation


def _owned_cash_balance(user, cash_balance_id, lock=False):
    queryset = CashBalance.objects.select_related(
        "account", "currency"
    ).filter(pk=cash_balance_id, account__user=user, account__deleted=False)
    if lock:
        queryset = queryset.select_for_update()
    balance = queryset.first()
    if not balance:
        raise ValueError("Cash balance not found in an active account.")
    return balance


def _converted(amount, source, target, rates):
    if source == target:
        return _decimal(amount)
    key = (source, target)
    if key not in rates:
        rates[key] = convert_amount(Decimal("1"), source, target, None)
    return _decimal(amount) * rates[key]


@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def portfolio(request):
    """Current security positions and tangible assets in one target currency."""
    currency = request.GET.get("currency", "EUR").upper()
    rates = {}
    positions = {}
    try:
        accounts = Account.objects.filter(
            user=request.user, deleted=False
        ).prefetch_related(
            "holdings__security__currency", "holdings__security__prices"
        )
        for account in accounts:
            for holding in account.holdings.all():
                if holding.quantity <= 0:
                    continue
                security = holding.security
                latest = security.prices.first()
                native_price = latest.price if latest else holding.average_cost
                native_value = holding.quantity * native_price
                native_cost = holding.quantity * holding.average_cost
                item = positions.setdefault(
                    security.id,
                    {
                        "id": f"security:{security.id}",
                        "kind": "security",
                        "security_id": security.id,
                        "ticker": security.ticker,
                        "name": security.name,
                        "asset_class": security.asset_class,
                        "asset_class_label": security.get_asset_class_display(),
                        "security_currency": security.currency.code,
                        "quantity": Decimal("0"),
                        "cost_basis": Decimal("0"),
                        "current_value": Decimal("0"),
                        "latest_price": native_price,
                        "holdings": [],
                    },
                )
                item["quantity"] += holding.quantity
                item["cost_basis"] += _converted(
                    native_cost, security.currency.code, currency, rates
                )
                item["current_value"] += _converted(
                    native_value, security.currency.code, currency, rates
                )
                item["holdings"].append(
                    {
                        "holding_id": holding.id,
                        "account_id": account.id,
                        "account_name": account.name,
                        "quantity": float(holding.quantity),
                        "currency": security.currency.code,
                    }
                )
        security_positions = []
        security_by_class = {}
        investments = Decimal("0")
        for item in positions.values():
            item["quantity"] = float(item["quantity"])
            item["cost_basis"] = float(item["cost_basis"])
            item["current_value"] = float(item["current_value"])
            item["latest_price"] = float(item["latest_price"])
            item["unrealized_pnl"] = round(
                item["current_value"] - item["cost_basis"], 2
            )
            investments += _decimal(item["current_value"])
            security_by_class[item["asset_class"]] = security_by_class.get(
                item["asset_class"], Decimal("0")
            ) + _decimal(item["current_value"])
            security_positions.append(item)
        tangible = list(_assets_queryset(request.user).filter(status="active"))
        tangible_payload = TangibleAssetSerializer(
            tangible, many=True, context=_serializer_context(request)
        ).data
        tangible_total = Decimal("0")
        tangible_by_type = {}
        for asset, serialized in zip(tangible, tangible_payload):
            value = _converted(
                _asset_current_value(asset, timezone.localdate()),
                asset.currency.code,
                currency,
                rates,
            )
            serialized["position_id"] = f"tangible:{asset.id}"
            serialized["tangible_id"] = asset.id
            serialized["kind"] = "tangible"
            serialized["current_value_converted"] = float(value)
            tangible_total += value
            tangible_by_type[asset.asset_type] = (
                tangible_by_type.get(asset.asset_type, Decimal("0")) + value
            )
        labels = dict(TangibleAsset.ASSET_TYPE_CHOICES)
        return Response(
            {
                "currency": currency,
                "summary": {
                    "investments": float(investments),
                    "tangible_assets": float(tangible_total),
                    "total": float(investments + tangible_total),
                },
                "security_positions": sorted(
                    security_positions,
                    key=lambda item: item["current_value"],
                    reverse=True,
                ),
                "tangible_assets": tangible_payload,
                "allocation": {
                    "groups": [
                        {
                            "key": "investments",
                            "label": "Investments",
                            "amount": float(investments),
                        },
                        {
                            "key": "tangible_assets",
                            "label": "Tangible Assets",
                            "amount": float(tangible_total),
                        },
                    ],
                    "security_asset_classes": [
                        {
                            "key": key,
                            "label": dict(Security.ASSET_CLASS_CHOICES).get(
                                key, key
                            ),
                            "amount": float(value),
                        }
                        for key, value in sorted(security_by_class.items())
                    ],
                    "tangible_types": [
                        {
                            "key": key,
                            "label": labels.get(key, key),
                            "amount": float(value),
                        }
                        for key, value in sorted(tangible_by_type.items())
                    ],
                },
            }
        )
    except MissingExchangeRate as exc:
        return Response(
            {"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST
        )


@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def activity(request):
    kind = request.GET.get("kind", "all")
    query = request.GET.get("query", "").strip()
    include_drafts = request.GET.get("include_drafts", "false").lower() in (
        "true",
        "1",
        "yes",
    )
    queryset = (
        Transaction.objects.filter(
            user=request.user, transaction_type__in=("buy", "sell")
        )
        .select_related(
            "trade_detail__security",
            "trade_detail__tangible_asset",
            "trade_detail__cash_balance__currency",
        )
        .order_by("-date", "-id")
    )
    if not include_drafts:
        queryset = queryset.filter(is_draft=False)
    if kind == "security":
        queryset = queryset.filter(trade_detail__security__isnull=False)
    elif kind == "tangible":
        queryset = queryset.filter(trade_detail__tangible_asset__isnull=False)
    if query:
        queryset = queryset.filter(
            Q(trade_detail__security__ticker__icontains=query)
            | Q(trade_detail__security__name__icontains=query)
            | Q(trade_detail__tangible_asset__name__icontains=query)
            | Q(trade_detail__tangible_asset__asset_type__icontains=query)
        )
    from_date = request.GET.get("from_date")
    to_date = request.GET.get("to_date")
    if from_date:
        queryset = queryset.filter(date__gte=from_date)
    if to_date:
        queryset = queryset.filter(date__lte=to_date)
    try:
        limit = min(max(int(request.GET.get("limit", 100)), 1), 250)
        offset = max(int(request.GET.get("offset", 0)), 0)
    except ValueError:
        return Response(
            {"error": "limit and offset must be whole numbers."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    total = queryset.count()
    return Response(
        {
            "count": total,
            "results": TransactionReadSerializer(
                queryset[offset : offset + limit], many=True
            ).data,
        }
    )


@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def securities(request):
    query = request.GET.get("query", "").strip()
    queryset = Security.objects.all().select_related("currency")
    if query:
        queryset = queryset.filter(
            Q(ticker__icontains=query) | Q(name__icontains=query)
        )
    queryset = queryset.order_by("ticker")[:25]
    return Response(
        [
            {
                "id": item.id,
                "ticker": item.ticker,
                "name": item.name,
                "asset_class": item.asset_class,
                "asset_class_label": item.get_asset_class_display(),
                "currency": {
                    "id": item.currency_id,
                    "code": item.currency.code,
                    "symbol": item.currency.symbol,
                },
            }
            for item in queryset
        ]
    )


@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def units(request):
    queryset = Unit.objects.filter(is_active=True).order_by(
        "dimension", "name"
    )
    return Response(UnitSerializer(queryset, many=True).data)


@api_view(["GET", "POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def asset_collection(request):
    if request.method == "GET":
        state = request.GET.get("status", "active")
        queryset = _assets_queryset(request.user)
        if state != "all":
            if state not in dict(TangibleAsset.STATUS_CHOICES):
                return Response({"error": "Invalid status."}, status=400)
            queryset = queryset.filter(status=state)
        assets = list(queryset)
        currency = request.GET.get("currency", "EUR").upper()
        try:
            summary = _summary(assets, currency)
        except MissingExchangeRate as exc:
            return Response({"error": str(exc)}, status=400)
        return Response(
            {
                "summary": summary,
                "assets": TangibleAssetSerializer(
                    assets, many=True, context=_serializer_context(request)
                ).data,
            }
        )

    payload = request.data.copy()
    current_value = payload.pop("current_value", None)
    valuation_date = payload.pop("valuation_date", None)
    valuation_notes = payload.pop("valuation_notes", "")
    serializer = TangibleAssetSerializer(
        data=payload, context=_serializer_context(request)
    )
    serializer.is_valid(raise_exception=True)
    with db_transaction.atomic():
        asset = serializer.save(user=request.user)
        _create_valuation(asset, asset.acquisition_cost, asset.acquired_on)
        if current_value not in (None, ""):
            value_date = (
                _date(valuation_date, "valuation_date")
                if valuation_date
                else timezone.localdate()
            )
            if value_date == asset.acquired_on:
                valuation = asset.valuations.get(date=value_date)
                valuation.value = _decimal(current_value)
                valuation.notes = valuation_notes
                valuation.source = "manual"
                valuation.full_clean()
                valuation.save()
            else:
                _create_valuation(
                    asset,
                    _decimal(current_value),
                    value_date,
                    source="manual",
                    notes=valuation_notes,
                )
    asset = _assets_queryset(request.user).get(pk=asset.pk)
    return Response(
        TangibleAssetSerializer(
            asset, context=_serializer_context(request)
        ).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET", "PATCH", "DELETE"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def asset_detail(request, asset_id):
    asset = get_object_or_404(_assets_queryset(request.user), pk=asset_id)
    if request.method == "GET":
        return Response(
            TangibleAssetSerializer(
                asset, context=_serializer_context(request)
            ).data
        )
    if request.method == "PATCH":
        serializer = TangibleAssetSerializer(
            asset,
            data=request.data,
            partial=True,
            context=_serializer_context(request),
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            TangibleAssetSerializer(
                asset, context=_serializer_context(request)
            ).data
        )

    if asset.trades.exists():
        return Response(
            {"error": "Use undo-last-event for an asset with trades."},
            status=409,
        )
    asset.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def purchase(request):
    payload = request.data.copy()
    cash_balance_id = payload.pop("from_cash_balance", None)
    tx_date = payload.pop("date", None)
    description = payload.pop("description", "")
    tags = payload.pop("tags", [])
    amount = payload.pop("amount", payload.get("acquisition_cost"))
    payload["acquisition_cost"] = amount
    if not cash_balance_id or not tx_date or amount in (None, ""):
        return Response(
            {"error": "date, amount, and from_cash_balance are required."},
            status=400,
        )
    amount = _decimal(amount)
    try:
        tx_date = _date(tx_date)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=400)
    if amount <= 0:
        return Response(
            {"error": "amount must be greater than zero."}, status=400
        )

    with db_transaction.atomic():
        try:
            cash_balance = _owned_cash_balance(
                request.user, cash_balance_id, lock=True
            )
        except ValueError as exc:
            return Response({"error": str(exc)}, status=400)
        if cash_balance.balance < amount:
            return Response(
                {"error": "Insufficient cash balance."}, status=400
            )
        currency = payload.get("currency_id")
        if currency and int(currency) != cash_balance.currency_id:
            return Response(
                {"error": "Asset currency must match cash balance."},
                status=400,
            )
        payload["currency_id"] = cash_balance.currency_id
        payload["acquired_on"] = tx_date
        serializer = TangibleAssetSerializer(
            data=payload, context=_serializer_context(request)
        )
        serializer.is_valid(raise_exception=True)
        asset = serializer.save(user=request.user)
        _create_valuation(asset, amount, tx_date)
        txn = Transaction.objects.create(
            user=request.user,
            transaction_type="buy",
            date=tx_date,
            description=description,
            amount=amount,
            from_account=cash_balance.account,
        )
        detail = TradeDetail(
            transaction=txn,
            tangible_asset=asset,
            cash_balance=cash_balance,
            quantity=Decimal("1"),
            price_per_unit=amount,
        )
        detail.full_clean()
        detail.save()
        CashBalance.objects.filter(pk=cash_balance.pk).update(
            balance=F("balance") - amount
        )
    return Response({"id": asset.id, "transaction_id": txn.id}, status=201)


@api_view(["GET", "POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def valuations(request, asset_id):
    asset = get_object_or_404(_assets_queryset(request.user), pk=asset_id)
    if request.method == "GET":
        return Response(
            TangibleAssetValuationSerializer(
                asset.valuations.all(), many=True
            ).data
        )
    serializer = TangibleAssetValuationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    with db_transaction.atomic():
        valuation = TangibleAssetValuation(
            asset=asset, source="manual", **serializer.validated_data
        )
        valuation.full_clean()
        valuation.save()
    return Response(
        TangibleAssetValuationSerializer(valuation).data, status=201
    )


@api_view(["DELETE"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def valuation_detail(request, asset_id, valuation_id):
    asset = get_object_or_404(_assets_queryset(request.user), pk=asset_id)
    valuation = get_object_or_404(
        TangibleAssetValuation, pk=valuation_id, asset=asset
    )
    if asset.valuations.first().id != valuation.id:
        return Response(
            {"error": "Only latest valuation can be removed."}, status=409
        )
    if valuation.source == "acquisition":
        return Response(
            {"error": "Acquisition valuation cannot be removed."}, status=409
        )
    valuation.delete()
    return Response(status=204)


@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def sell(request, asset_id):
    asset = get_object_or_404(
        _assets_queryset(request.user), pk=asset_id, status="active"
    )
    tx_date = request.data.get("date")
    amount = request.data.get("amount")
    cash_balance_id = request.data.get("to_cash_balance")
    if not tx_date or amount in (None, "") or not cash_balance_id:
        return Response(
            {"error": "date, amount, and to_cash_balance are required."},
            status=400,
        )
    amount = _decimal(amount)
    try:
        tx_date = _date(tx_date)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=400)
    if amount <= 0:
        return Response(
            {"error": "amount must be greater than zero."}, status=400
        )
    if (
        tx_date < asset.acquired_on
        or asset.valuations.filter(date__gt=tx_date).exists()
    ):
        return Response(
            {"error": "Sale cannot precede an existing asset event."},
            status=400,
        )
    with db_transaction.atomic():
        try:
            cash_balance = _owned_cash_balance(
                request.user, cash_balance_id, lock=True
            )
        except ValueError as exc:
            return Response({"error": str(exc)}, status=400)
        if cash_balance.currency_id != asset.currency_id:
            return Response(
                {"error": "Sale currency must match asset currency."},
                status=400,
            )
        txn = Transaction.objects.create(
            user=request.user,
            transaction_type="sell",
            date=tx_date,
            description=request.data.get("description", ""),
            amount=amount,
            to_account=cash_balance.account,
        )
        detail = TradeDetail(
            transaction=txn,
            tangible_asset=asset,
            cash_balance=cash_balance,
            quantity=Decimal("1"),
            price_per_unit=amount,
        )
        detail.full_clean()
        detail.save()
        CashBalance.objects.filter(pk=cash_balance.pk).update(
            balance=F("balance") + amount
        )
        asset.status = "sold"
        asset.disposed_on = tx_date
        asset.disposal_reason = ""
        asset.full_clean()
        asset.save(
            update_fields=[
                "status",
                "disposed_on",
                "disposal_reason",
                "updated_on",
            ]
        )
    return Response({"transaction_id": txn.id})


@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def dispose(request, asset_id):
    asset = get_object_or_404(
        _assets_queryset(request.user), pk=asset_id, status="active"
    )
    disposal_date = request.data.get("date")
    try:
        disposal_date = _date(disposal_date)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=400)
    if disposal_date < asset.acquired_on:
        return Response(
            {"error": "Valid disposition date is required."}, status=400
        )
    if asset.valuations.filter(date__gt=disposal_date).exists():
        return Response(
            {"error": "Disposition precedes an existing valuation."},
            status=400,
        )
    asset.status = "disposed"
    asset.disposed_on = disposal_date
    asset.disposal_reason = request.data.get("reason", "")
    asset.full_clean()
    asset.save(
        update_fields=[
            "status",
            "disposed_on",
            "disposal_reason",
            "updated_on",
        ]
    )
    return Response(
        TangibleAssetSerializer(
            asset, context=_serializer_context(request)
        ).data
    )


@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def undo_last_event(request, asset_id):
    asset = get_object_or_404(_assets_queryset(request.user), pk=asset_id)
    with db_transaction.atomic():
        asset = TangibleAsset.objects.select_for_update().get(pk=asset.id)
        if asset.status == "disposed":
            asset.status = "active"
            asset.disposed_on = None
            asset.disposal_reason = ""
            asset.save(
                update_fields=[
                    "status",
                    "disposed_on",
                    "disposal_reason",
                    "updated_on",
                ]
            )
            return Response({"message": "Disposal undone."})
        latest_trade = (
            asset.trades.select_related("transaction", "cash_balance")
            .order_by("-transaction__date", "-id")
            .first()
        )
        if not latest_trade:
            return Response(
                {"error": "No lifecycle event to undo."}, status=409
            )
        txn = latest_trade.transaction
        if asset.valuations.filter(date__gt=txn.date).exists():
            return Response(
                {"error": "Later valuation prevents undo."}, status=409
            )
        if txn.transaction_type == "sell":
            CashBalance.objects.filter(pk=latest_trade.cash_balance_id).update(
                balance=F("balance") - txn.amount
            )
            asset.status = "active"
            asset.disposed_on = None
            asset.disposal_reason = ""
            asset.save(
                update_fields=[
                    "status",
                    "disposed_on",
                    "disposal_reason",
                    "updated_on",
                ]
            )
            txn.delete()
            return Response({"message": "Sale undone."})
        if txn.transaction_type == "buy":
            CashBalance.objects.filter(pk=latest_trade.cash_balance_id).update(
                balance=F("balance") + txn.amount
            )
            txn.delete()
            asset.delete()
            return Response({"message": "Purchase undone."})
    return Response({"error": "Unsupported lifecycle event."}, status=409)
