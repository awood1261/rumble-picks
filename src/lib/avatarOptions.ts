export type AvatarOption = {
  key: string;
  label: string;
  src: string;
};

export const DEFAULT_AVATAR_KEY = "default";

export const AVATAR_OPTIONS: AvatarOption[] = [
  { key: "default", label: "Classic", src: "/images/avatars/default.svg" },
  {
    key: "luchador-mask",
    label: "Luchador Mask",
    src: "/images/avatars/luchador-mask.svg",
  },
  {
    key: "championship-belt",
    label: "Championship Belt",
    src: "/images/avatars/championship-belt.svg",
  },
  { key: "ring-bell", label: "Ring Bell", src: "/images/avatars/ring-bell.svg" },
  { key: "turnbuckle", label: "Turnbuckle", src: "/images/avatars/turnbuckle.svg" },
  { key: "crown", label: "Crown", src: "/images/avatars/crown.svg" },
  { key: "lightning", label: "Lightning", src: "/images/avatars/lightning.svg" },
  { key: "skull", label: "Skull", src: "/images/avatars/skull.svg" },
  { key: "bull", label: "Bull", src: "/images/avatars/bull.svg" },
  { key: "wolf", label: "Wolf", src: "/images/avatars/wolf.svg" },
  { key: "dragon", label: "Dragon", src: "/images/avatars/dragon.svg" },
  { key: "microphone", label: "Microphone", src: "/images/avatars/microphone.svg" },
  { key: "boot", label: "Wrestling Boot", src: "/images/avatars/boot.svg" },
  { key: "eagle", label: "Eagle", src: "/images/avatars/eagle.svg" },
  { key: "flame", label: "Flame", src: "/images/avatars/flame.svg" },
];

export const avatarSrcForKey = (key: string | null | undefined) =>
  AVATAR_OPTIONS.find((option) => option.key === key)?.src ??
  AVATAR_OPTIONS[0].src;
