import { fireEvent, render, screen } from "@testing-library/react";
import {
  EmptyState,
  InsightsPanel,
  SegmentedControl,
  WorkspaceHero,
  WorkspaceShell,
} from "./workspace";

describe("workspace primitives", () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
  });

  test("renders a semantic shell and hero content", () => {
    const { container } = render(
      <WorkspaceShell>
        <WorkspaceHero
          eyebrow="Portfolio"
          title="Overview"
          description="Your finances"
        />
      </WorkspaceShell>
    );
    expect(container.querySelector("main.workspace-shell")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Overview" })
    ).toBeInTheDocument();
    expect(screen.getByText("Your finances")).toBeInTheDocument();
  });

  test("segmented controls expose and update their pressed state", () => {
    const onChange = jest.fn();
    render(
      <SegmentedControl
        label="Views"
        value="income"
        onChange={onChange}
        options={[
          { value: "income", label: "Income" },
          { value: "expense", label: "Expense" },
        ]}
      />
    );
    expect(screen.getByRole("button", { name: "Income" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "Expense" }));
    expect(onChange).toHaveBeenCalledWith("expense");
  });

  test("insights are keyboard-accessible and persist their state", () => {
    const { unmount } = render(
      <InsightsPanel storageKey="test-insights">
        <div>Chart content</div>
      </InsightsPanel>
    );
    const toggle = screen.getByRole("button", { name: /insights/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(localStorage.getItem("test-insights")).toBe("true");
    unmount();
    render(
      <InsightsPanel storageKey="test-insights">
        <div>Chart content</div>
      </InsightsPanel>
    );
    expect(screen.getByRole("button", { name: /insights/i })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  test("does not mount chart content while phone insights are collapsed", () => {
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: query === "(max-width: 640px)",
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
    render(
      <InsightsPanel storageKey="phone-insights">
        <div>Deferred chart</div>
      </InsightsPanel>
    );
    expect(screen.queryByText("Deferred chart")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /insights/i }));
    expect(screen.getByText("Deferred chart")).toBeInTheDocument();
  });

  test("empty states keep their action accessible", () => {
    render(
      <EmptyState
        title="No transactions"
        description="Change your filters"
        action={<button>Add transaction</button>}
      />
    );
    expect(
      screen.getByRole("heading", { name: "No transactions" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add transaction" })
    ).toBeInTheDocument();
  });
});
