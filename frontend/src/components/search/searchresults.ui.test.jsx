import { fireEvent, render, screen } from "@testing-library/react";
import {
  TransactionRow,
  buildActiveChips,
  groupResults,
} from "./searchresults";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("recharts", () => ({
  Bar: () => null,
  BarChart: ({ children }) => <div>{children}</div>,
  CartesianGrid: () => null,
  Legend: () => null,
  Line: () => null,
  LineChart: ({ children }) => <div>{children}</div>,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const trade = {
  id: 9,
  transaction_type: "buy",
  date: "2026-08-20",
  description: "Index investment",
  amount: 100,
  converted_amount: 92,
  currency: "USD",
  security_ticker: "SPY",
  from_account_name: "Broker",
  tags: [{ id: 1, name: "long-term" }],
  pinned: true,
  is_draft: false,
};

test("renders trades in the unified selectable result row", () => {
  const toggle = jest.fn();
  const open = jest.fn();
  render(
    <TransactionRow
      transaction={trade}
      currency="EUR"
      privacyMode={false}
      selected={false}
      toggleSelected={toggle}
      open={open}
    />
  );
  expect(screen.getByText("Buys")).toBeInTheDocument();
  expect(screen.getByText("SPY")).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Select transaction 9"));
  expect(toggle).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: /index investment/i }));
  expect(open).toHaveBeenCalledTimes(1);
});

test("groups results and exposes URL-backed filters as removable chips", () => {
  expect(Object.keys(groupResults([trade], "account"))).toEqual(["Broker"]);
  const params = new URLSearchParams("q=spy&types=buy&page=2");
  expect(buildActiveChips(params).map((chip) => chip.key)).toEqual([
    "q",
    "types",
  ]);
});
