import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Login from "./login";
import Register from "./register";
import { useGlobalContext } from "../../context/GlobalContext";
import { useToast } from "../../context/ToastContext";

jest.mock("../../context/GlobalContext", () => ({
  useGlobalContext: jest.fn(),
}));
jest.mock("../../context/ToastContext", () => ({ useToast: jest.fn() }));

const renderAuth = (component) =>
  render(<BrowserRouter>{component}</BrowserRouter>);

describe("authentication forms", () => {
  const showToast = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useToast.mockReturnValue(showToast);
  });

  test("login exposes labelled controls and can reveal the password", () => {
    useGlobalContext.mockReturnValue({ authToken: null, loginUser: jest.fn() });
    renderAuth(<Login />);

    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
  });

  test("login keeps entered credentials and surfaces a server error", async () => {
    useGlobalContext.mockReturnValue({
      authToken: null,
      loginUser: jest.fn().mockRejectedValue(new Error("Invalid credentials")),
    });
    renderAuth(<Login />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "incorrect" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Invalid credentials"
      );
    });
    expect(screen.getByLabelText("Email address")).toHaveValue(
      "user@example.com"
    );
    expect(showToast).toHaveBeenCalledWith("Invalid credentials", "error");
  });

  test("registration presents the complete labelled account form", () => {
    useGlobalContext.mockReturnValue({
      authToken: null,
      registerUser: jest.fn(),
    });
    renderAuth(<Register />);

    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone number")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create account" })
    ).toBeInTheDocument();
  });
});
