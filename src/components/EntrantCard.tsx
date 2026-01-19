type EntrantCardProps = {
  name: string;
  promotion?: string | null;
  imageUrl?: string | null;
  className?: string;
};

const PLACEHOLDER_IMAGE = "/images/placeholder-avatar.svg";

export const EntrantCard = ({
  name,
  promotion,
  imageUrl,
  className = "",
}: EntrantCardProps) => {
  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <img
        className="h-9 w-9 rounded-full border border-zinc-800 bg-zinc-900 object-cover"
        src={imageUrl || PLACEHOLDER_IMAGE}
        alt={name}
        loading="lazy"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-100">{name}</p>
        {promotion ? <p className="text-xs text-zinc-500">{promotion}</p> : null}
      </div>
    </div>
  );
};
