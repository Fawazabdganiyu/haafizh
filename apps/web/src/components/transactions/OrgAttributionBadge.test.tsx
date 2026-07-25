import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrgAttributionBadge } from "./OrgAttributionBadge";

describe("OrgAttributionBadge", () => {
  it("renders nothing when there is no org source transaction", () => {
    const { container } = render(<OrgAttributionBadge orgSourceTransaction={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the org source transaction has no organisation", () => {
    const { container } = render(
      <OrgAttributionBadge orgSourceTransaction={{ organisation: null }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the org name when there is no linked project", () => {
    render(
      <OrgAttributionBadge
        orgSourceTransaction={{ organisation: { id: "org-1", name: "Acme Org" } }}
      />,
    );
    expect(screen.getByText(/On behalf of Acme Org/)).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  it("renders the org name and project name when a project is linked", () => {
    render(
      <OrgAttributionBadge
        orgSourceTransaction={{
          organisation: { id: "org-1", name: "Acme Org" },
          projectTransaction: { project: { id: "proj-1", name: "Q1 Fundraiser" } },
        }}
      />,
    );
    expect(screen.getByText(/On behalf of Acme Org · Q1 Fundraiser/)).toBeInTheDocument();
  });
});
