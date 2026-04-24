#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8010}"
BASE_URL="${BASE_URL:-http://${HOST}:${PORT}}"
API_BASE="$BASE_URL/transactions"
RUN_ID="$(date +%s)"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_cmd curl
require_cmd jq
require_cmd uv

SERVER_PID=""
cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

ensure_server() {
  local probe_status
  probe_status="$(curl -sS -o /dev/null -w "%{http_code}" "$API_BASE/all" 2>/dev/null || true)"
  if [[ "$probe_status" == "200" || "$probe_status" == "401" || "$probe_status" == "403" || "$probe_status" == "405" ]]; then
    echo "Using existing server at $BASE_URL"
    return
  fi

  echo "Starting backend server at $BASE_URL"
  (
    cd "$BACKEND_DIR"
    uv run python manage.py runserver "${HOST}:${PORT}" >/tmp/transactions_smoke_server.log 2>&1
  ) &
  SERVER_PID=$!

  for _ in $(seq 1 30); do
    probe_status="$(curl -sS -o /dev/null -w "%{http_code}" "$API_BASE/all" 2>/dev/null || true)"
    if [[ "$probe_status" == "200" || "$probe_status" == "401" || "$probe_status" == "403" || "$probe_status" == "405" ]]; then
      echo "Server is ready"
      return
    fi
    sleep 1
  done

  echo "Server did not start in time. Check /tmp/transactions_smoke_server.log"
  exit 1
}

api_call() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local auth_header="$4"
  local tmpfile
  tmpfile="$(mktemp)"

  local status
  if [[ -n "$body" ]]; then
    status="$(curl -sS -o "$tmpfile" -w "%{http_code}" -X "$method" "$API_BASE/$path" \
      -H "$auth_header" \
      -H "Content-Type: application/json" \
      -d "$body")"
  else
    status="$(curl -sS -o "$tmpfile" -w "%{http_code}" -X "$method" "$API_BASE/$path" \
      -H "$auth_header")"
  fi

  local response
  response="$(cat "$tmpfile")"
  rm -f "$tmpfile"

  if [[ "$status" -lt 200 || "$status" -ge 300 ]]; then
    echo "API call failed: $method /$path (HTTP $status)"
    echo "$response" | jq . 2>/dev/null || echo "$response"
    exit 1
  fi

  echo "$response"
}

assert_state() {
  local user_id="$1"
  local usd_balance_id="$2"
  local eur_balance_id="$3"
  local security_id="$4"
  local account_id="$5"
  local expected_usd="$6"
  local expected_eur="$7"
  local expected_qty="$8"

  (
    cd "$BACKEND_DIR"
    USER_ID="$user_id" \
    USD_BALANCE_ID="$usd_balance_id" \
    EUR_BALANCE_ID="$eur_balance_id" \
    SECURITY_ID="$security_id" \
    ACCOUNT_ID="$account_id" \
    EXPECTED_USD="$expected_usd" \
    EXPECTED_EUR="$expected_eur" \
    EXPECTED_QTY="$expected_qty" \
    uv run python manage.py shell -c "
import os
from decimal import Decimal
from Accounts.models import CashBalance, Holding

usd = CashBalance.objects.get(pk=int(os.environ['USD_BALANCE_ID']))
eur = CashBalance.objects.get(pk=int(os.environ['EUR_BALANCE_ID']))
holding = Holding.objects.filter(
    account_id=int(os.environ['ACCOUNT_ID']),
    security_id=int(os.environ['SECURITY_ID']),
).first()

qty = holding.quantity if holding else Decimal('0')
exp_usd = Decimal(os.environ['EXPECTED_USD'])
exp_eur = Decimal(os.environ['EXPECTED_EUR'])
exp_qty = Decimal(os.environ['EXPECTED_QTY'])

assert usd.balance == exp_usd, f'USD mismatch: expected {exp_usd}, got {usd.balance}'
assert eur.balance == exp_eur, f'EUR mismatch: expected {exp_eur}, got {eur.balance}'
assert qty == exp_qty, f'Holding qty mismatch: expected {exp_qty}, got {qty}'
print('State OK')
" >/dev/null
  )
}

echo "Preparing smoke fixtures..."
fixture_json="$(
  cd "$BACKEND_DIR"
  RUN_ID="$RUN_ID" uv run python manage.py shell -c "
import json
import os
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from Accounts.models import Account, CashBalance, Currency, Security
from Transactions.models import TransactionCategory

run_id = os.environ['RUN_ID']
User = get_user_model()

user, created = User.objects.get_or_create(
    email='smoke@test.local',
    defaults={'name': 'Smoke Test', 'phone': '+10000000000'},
)
if created:
    user.set_password('smoke1234')
    user.save(update_fields=['password'])

token, _ = Token.objects.get_or_create(user=user)

usd, _ = Currency.objects.get_or_create(
    code='USD',
    defaults={'name': 'US Dollar', 'symbol': '$', 'currency_type': 'fiat'},
)
eur, _ = Currency.objects.get_or_create(
    code='EUR',
    defaults={'name': 'Euro', 'symbol': '€', 'currency_type': 'fiat'},
)

account = Account.objects.create(
    user=user,
    name=f'Smoke Broker {run_id}',
    type=1,
    amount=0,
    currency='EUR',
)
usd_balance = CashBalance.objects.create(account=account, currency=usd, balance=10000)
eur_balance = CashBalance.objects.create(account=account, currency=eur, balance=5000)

income_cat, _ = TransactionCategory.objects.get_or_create(
    category='Salary',
    category_type=0,
)
expense_cat, _ = TransactionCategory.objects.get_or_create(
    category='Food',
    category_type=1,
)

security, _ = Security.objects.get_or_create(
    ticker='SPY',
    defaults={
        'name': 'SPDR S&P 500 ETF Trust',
        'currency': usd,
        'structure': 'etf',
        'asset_class': 'equity',
    },
)

print(json.dumps({
    'user_id': user.id,
    'token': token.key,
    'account_id': account.id,
    'usd_balance_id': usd_balance.id,
    'eur_balance_id': eur_balance.id,
    'income_category_id': income_cat.id,
    'expense_category_id': expense_cat.id,
    'security_id': security.id,
}))
"
)"

TOKEN="$(echo "$fixture_json" | jq -r '.token')"
USER_ID="$(echo "$fixture_json" | jq -r '.user_id')"
ACCOUNT_ID="$(echo "$fixture_json" | jq -r '.account_id')"
USD_BALANCE_ID="$(echo "$fixture_json" | jq -r '.usd_balance_id')"
EUR_BALANCE_ID="$(echo "$fixture_json" | jq -r '.eur_balance_id')"
INCOME_CATEGORY_ID="$(echo "$fixture_json" | jq -r '.income_category_id')"
EXPENSE_CATEGORY_ID="$(echo "$fixture_json" | jq -r '.expense_category_id')"
SECURITY_ID="$(echo "$fixture_json" | jq -r '.security_id')"

AUTH_HEADER="Authorization: Token $TOKEN"

ensure_server

echo "Creating income/expense/transfer/buy/sell transactions..."
income_resp="$(api_call POST add "{\"transaction_type\":\"income\",\"date\":\"2026-04-18\",\"description\":\"smoke income\",\"amount\":\"1000\",\"to_cash_balance\":$USD_BALANCE_ID,\"category\":$INCOME_CATEGORY_ID}" "$AUTH_HEADER")"
expense_resp="$(api_call POST add "{\"transaction_type\":\"expense\",\"date\":\"2026-04-18\",\"description\":\"smoke expense\",\"amount\":\"100\",\"from_cash_balance\":$USD_BALANCE_ID,\"category\":$EXPENSE_CATEGORY_ID}" "$AUTH_HEADER")"
transfer_resp="$(api_call POST add "{\"transaction_type\":\"transfer\",\"date\":\"2026-04-18\",\"description\":\"smoke transfer\",\"from_amount\":\"200\",\"to_amount\":\"180\",\"from_cash_balance\":$USD_BALANCE_ID,\"to_cash_balance\":$EUR_BALANCE_ID}" "$AUTH_HEADER")"
buy_resp="$(api_call POST add "{\"transaction_type\":\"buy\",\"date\":\"2026-04-18\",\"description\":\"smoke buy\",\"security\":$SECURITY_ID,\"from_cash_balance\":$USD_BALANCE_ID,\"quantity\":\"2\",\"price_per_unit\":\"500\"}" "$AUTH_HEADER")"
HOLDING_ID="$(
  cd "$BACKEND_DIR"
  ACCOUNT_ID="$ACCOUNT_ID" SECURITY_ID="$SECURITY_ID" uv run python manage.py shell -c "
from Accounts.models import Holding
import os
h = Holding.objects.filter(
    account_id=int(os.environ['ACCOUNT_ID']),
    security_id=int(os.environ['SECURITY_ID']),
).first()
print(h.id if h else '')
" | tail -n1
)"
if [[ -z "$HOLDING_ID" ]]; then
  echo "Unable to resolve holding after buy transaction."
  exit 1
fi
sell_resp="$(api_call POST add "{\"transaction_type\":\"sell\",\"date\":\"2026-04-18\",\"description\":\"smoke sell\",\"holding\":$HOLDING_ID,\"to_cash_balance\":$USD_BALANCE_ID,\"quantity\":\"1\",\"price_per_unit\":\"510\"}" "$AUTH_HEADER")"

SELL_TX_ID="$(echo "$sell_resp" | jq -r '.id')"
TRANSFER_TX_ID="$(echo "$transfer_resp" | jq -r '.id')"

assert_state "$USER_ID" "$USD_BALANCE_ID" "$EUR_BALANCE_ID" "$SECURITY_ID" "$ACCOUNT_ID" "10210.00000000" "5180.00000000" "1.00000000"
echo "State check after create flow: OK"

echo "Testing both delete endpoints and reversal..."
api_call DELETE "delete/$SELL_TX_ID" "" "$AUTH_HEADER" >/dev/null
api_call POST delete "{\"id\":$TRANSFER_TX_ID}" "$AUTH_HEADER" >/dev/null

assert_state "$USER_ID" "$USD_BALANCE_ID" "$EUR_BALANCE_ID" "$SECURITY_ID" "$ACCOUNT_ID" "9900.00000000" "5000.00000000" "2.00000000"
echo "State check after delete reversal: OK"

echo "Smoke test completed successfully."
