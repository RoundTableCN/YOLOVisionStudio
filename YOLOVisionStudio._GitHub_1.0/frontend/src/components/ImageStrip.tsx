import { useRef } from "react";
import type { Image as ImageType } from "@/types";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ImageStripProps {
  images: ImageType[];
  currentImageId: number | null;
  onSelectImage: (image: ImageType) => void;
}

export default function ImageStrip({ images, currentImageId, onSelectImage }: ImageStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
    }
  };

  return (
    <div className="h-24 bg-gray-900 border-t border-gray-800 flex items-center px-2 gap-1 flex-shrink-0">
      <button onClick={() => scroll("left")} className="p-1 hover:bg-gray-700 rounded flex-shrink-0">
        <ChevronLeft size={16} />
      </button>
      <div ref={scrollRef} className="flex gap-2 overflow-x-auto flex-1 py-1" style={{ scrollbarWidth: "thin" }}>
        {images.map((img) => (
          <div
            key={img.id}
            onClick={() => onSelectImage(img)}
            className={`flex-shrink-0 h-20 w-20 rounded overflow-hidden cursor-pointer border-2 transition-colors ${
              currentImageId === img.id ? "border-blue-500" : "border-transparent hover:border-gray-500"
            }`}
          >
            {img.thumbnail_path ? (
              <img
                src={`http://127.0.0.1:8618/api/thumbnail/${encodeURIComponent(img.thumbnail_path)}`}
                alt={img.filename}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-800 flex items-center justify-center text-xs text-gray-600">
                N/A
              </div>
            )}
          </div>
        ))}
      </div>
      <button onClick={() => scroll("right")} className="p-1 hover:bg-gray-700 rounded flex-shrink-0">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
