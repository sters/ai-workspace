import Link from "next/link";

const tools = [
  {
    href: "/utilities/workspace-prune",
    name: "Workspace Prune",
    description:
      "Delete workspaces not modified within the specified number of days.",
  },
];

export default function UtilitiesPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Utilities</h1>
      <div className="grid gap-3">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="block rounded-lg border p-4 hover:bg-accent"
          >
            <h2 className="font-semibold">{tool.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {tool.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
