import { fireEvent, render, screen } from "@testing-library/react";
import ToastProvider from "../context/ToastContext";
import { AccountModal, CreateAccount } from "./accounts";

jest.mock("../services/transactionService/transactionService", () => ({
  __esModule: true,
  default: { addAccount: jest.fn() },
}));
jest.mock("../services/transactionService/accountService", () => ({
  __esModule: true,
  default: {},
}));
jest.mock("../services/currencyService", () => ({
  __esModule: true,
  default: {},
}));
jest.mock("../context/GlobalContext", () => ({ useGlobalContext: jest.fn() }));
jest.mock("../context/ConfirmContext", () => ({ useConfirm: jest.fn() }));

describe("account form UI", () => {
  test("renders labelled opening-balance fields and separated modal actions", () => {
    render(
      <ToastProvider>
        <CreateAccount refreshAccounts={jest.fn()} onCancel={jest.fn()} />
      </ToastProvider>
    );

    expect(screen.getByLabelText("Account name")).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Opening cash balances" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Currency")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount")).toBeInTheDocument();
    expect(screen.getByLabelText("Account type")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add account" })
    ).toBeInTheDocument();
  });

  test("renders the account dialog in a body portal and restores focus", () => {
    const onClose = jest.fn();
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(
      <AccountModal onClose={onClose}>
        <p>Modal body</p>
      </AccountModal>
    );

    expect(document.body.querySelector(".workspace-modal")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
