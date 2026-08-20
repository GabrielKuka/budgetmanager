import { fireEvent, render, screen } from "@testing-library/react";
import { SuggestionItem } from "./navbar";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

test("search suggestions expose listbox option state and select cleanly", () => {
  const onSelect = jest.fn();
  render(
    <SuggestionItem
      id="search-option-0"
      active
      onActive={jest.fn()}
      onSelect={onSelect}
      getAccountCurrency={() => "EUR"}
      global={{ privacyMode: false }}
      suggestion={{
        id: 1,
        transaction_type: "expense",
        from_account: 2,
        date: "2026-08-20",
        description: "Broker fee",
        amount: "1.25",
        tags: [{ name: "IBKR" }],
      }}
    />
  );
  const option = screen.getByRole("option");
  expect(option).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("Broker fee")).toBeInTheDocument();
  fireEvent.click(option);
  expect(onSelect).toHaveBeenCalledTimes(1);
});
