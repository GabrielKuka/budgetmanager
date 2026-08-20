import { fireEvent, render, screen } from "@testing-library/react";
import { ActivityList } from "./assets";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));
jest.mock("../context/GlobalContext", () => ({ useGlobalContext: jest.fn() }));
jest.mock("../context/ConfirmContext", () => ({ useConfirm: jest.fn() }));
jest.mock("../context/ToastContext", () => ({ useToast: jest.fn() }));
jest.mock("../services/tangibleAssetService", () => ({
  __esModule: true,
  default: {},
}));
jest.mock("../services/transactionService/transactionService", () => ({
  __esModule: true,
  default: {},
}));
jest.mock("./dashboard/investmentChart", () => () => (
  <div>Investment chart</div>
));

describe("Assets activity pagination", () => {
  const row = {
    id: 1,
    asset_kind: "security",
    security_ticker: "ACME",
    security_name: "Acme Corp",
    date: "2026-08-20",
    transaction_type: "buy",
    amount: 25,
  };

  test("uses page controls and exposes the default page-size choice", () => {
    const onPageChange = jest.fn();
    const onPageSizeChange = jest.fn();
    render(
      <ActivityList
        rows={[row]}
        count={80}
        page={1}
        pageSize={25}
        loading={false}
        currency="EUR"
        onOpen={jest.fn()}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    );

    expect(screen.getByDisplayValue("25")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
    fireEvent.change(screen.getByDisplayValue("25"), {
      target: { value: "50" },
    });
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  test("shows an explicit empty activity state", () => {
    render(
      <ActivityList
        rows={[]}
        count={0}
        page={1}
        pageSize={25}
        loading={false}
        currency="EUR"
        onOpen={jest.fn()}
        onPageChange={jest.fn()}
        onPageSizeChange={jest.fn()}
      />
    );
    expect(screen.getByText(/No buy or sell activity/)).toBeInTheDocument();
  });
});
