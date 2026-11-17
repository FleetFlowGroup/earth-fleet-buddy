import { useRef } from "react";
import { Camera } from "lucide-react";
import { isNativeApp, takeNativePhoto } from "@/lib/native";

/** Web keeps the file input. The iOS shell opens the native camera first and appends that photo. */
export function NativePhotoInput({
  label,
  multiple = false,
  onFiles,
}: {
  label: string;
  multiple?: boolean;
  onFiles: (files: File[], source: "native" | "input") => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <label
      className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-sm"
      onClick={async (event) => {
        if (!isNativeApp()) return;
        event.preventDefault();
        try {
          const file = await takeNativePhoto();
          if (file) onFiles([file], "native");
        } catch {
          inputRef.current?.click();
        }
      }}
    >
      <Camera className="size-4" />
      <span>{label}</span>
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple={multiple}
        accept="image/*"
        capture="environment"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) onFiles(files, "input");
          event.target.value = "";
        }}
      />
    </label>
  );
}
