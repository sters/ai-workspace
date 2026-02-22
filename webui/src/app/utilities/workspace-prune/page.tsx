"use client";

import { UtilityPage } from "@/components/utilities/utility-page";

export default function WorkspacePrunePage() {
  return (
    <UtilityPage
      operationType="workspace-prune"
      name="Workspace Prune"
      description="Delete workspaces not modified within the specified number of days."
      fields={[
        { key: "days", label: "Days", placeholder: "7", type: "number" },
      ]}
    />
  );
}
