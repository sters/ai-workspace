"use client";

import { useState } from "react";
import { ClaudeOperation } from "../shared/claude-operation";
import type { OperationType } from "@/types/operation";

export function UtilityPage({
  operationType,
  name,
  description,
  fields,
}: {
  operationType: OperationType;
  name: string;
  description: string;
  fields?: { key: string; label: string; placeholder: string; type: string }[];
}) {
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">{name}</h1>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>

      {fields && fields.length > 0 && (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="mb-1 block text-xs font-medium">
                {field.label}
              </label>
              <input
                type={field.type}
                placeholder={field.placeholder}
                value={formValues[field.key] ?? ""}
                onChange={(e) =>
                  setFormValues((prev) => ({
                    ...prev,
                    [field.key]: e.target.value,
                  }))
                }
                className="w-32 rounded-md border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
              />
            </div>
          ))}
        </div>
      )}

      <ClaudeOperation storageKey={`utility:${operationType}`}>
        {({ start, isRunning }) =>
          !isRunning ? (
            <button
              onClick={() => start(operationType, { ...formValues })}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Run
            </button>
          ) : null
        }
      </ClaudeOperation>
    </div>
  );
}
