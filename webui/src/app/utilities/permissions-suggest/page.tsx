"use client";

import { UtilityPage } from "@/components/utility-page";

export default function PermissionsSuggestPage() {
  return (
    <UtilityPage
      operationType="permissions-suggest"
      name="Permissions Suggest"
      description="Detect blocked Bash commands from recent sessions and suggest permission settings."
    />
  );
}
