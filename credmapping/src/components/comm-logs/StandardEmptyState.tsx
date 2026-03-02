interface StandardEmptyStateProps {
  message: string;
}

export function StandardEmptyState({ message }: StandardEmptyStateProps) {
  return (
    <div className="border-border rounded-xl border-2 border-dashed py-12 text-center">
      <p className="text-muted-foreground text-sm font-medium italic">
        {message}
      </p>
    </div>
  );
}

