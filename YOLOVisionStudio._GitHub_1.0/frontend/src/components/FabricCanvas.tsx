import { useEffect, useRef, useCallback } from "react";
import { Canvas, Rect, FabricText, FabricImage } from "fabric";
import type { Annotation, Label } from "@/types";

interface FabricCanvasProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  annotations: Annotation[];
  labels: Label[];
  selectedLabelId: number | null;
  onAnnotationsChange: (annotations: Annotation[]) => void;
  zoom: number;
  onZoomChange: (z: number) => void;
}

export default function FabricCanvas({
  imageUrl,
  imageWidth,
  imageHeight,
  annotations,
  labels,
  selectedLabelId,
  onAnnotationsChange,
  zoom,
  onZoomChange,
}: FabricCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const isDrawingRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);

  const labelColorMap = new Map(labels.map((l) => [l.id, l.color]));
  const labelNameMap = new Map(labels.map((l) => [l.id, l.name]));

  const toYoloFormat = (rect: Rect, imgW: number, imgH: number) => {
    const c = rect.getCenterPoint();
    return {
      x_center: c.x / imgW,
      y_center: c.y / imgH,
      width: (rect.width || 1) / imgW,
      height: (rect.height || 1) / imgH,
    };
  };

  const buildAnnotationsFromCanvas = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objs = canvas.getObjects("rect") as Rect[];
    const newAnnotations: Annotation[] = objs.map((rect) => {
      const yolo = toYoloFormat(rect, imageWidth, imageHeight);
      return {
        id: (rect as any).annotationId || 0,
        image_id: 0,
        label_id: (rect as any).labelId || 0,
        x_center: yolo.x_center,
        y_center: yolo.y_center,
        width: yolo.width,
        height: yolo.height,
        created_at: "",
      };
    });
    onAnnotationsChange(newAnnotations);
  }, [imageWidth, imageHeight, onAnnotationsChange]);

  useEffect(() => {
    if (!canvasRef.current || !imageUrl) return;

    const canvas = new Canvas(canvasRef.current, {
      selection: true,
    });
    fabricRef.current = canvas;

    FabricImage.fromURL(imageUrl, { crossOrigin: "anonymous" }).then((img) => {
      const container = canvasRef.current?.parentElement;
      if (!container) return;
      const maxW = container.clientWidth - 40;
      const maxH = container.clientHeight - 40;
      const scale = Math.min(maxW / img.width!, maxH / img.height!, 1);
      canvas.setWidth(img.width! * scale);
      canvas.setHeight(img.height! * scale);
      img.scaleX = scale;
      img.scaleY = scale;
      img.selectable = false;
      img.evented = false;
      canvas.backgroundImage = img;
      canvas.renderAll();
    });

    canvas.on("mouse:down", (opt) => {
      if (!selectedLabelId || !opt.pointer || opt.target) return;
      isDrawingRef.current = true;
      startPointRef.current = { x: opt.pointer.x, y: opt.pointer.y };
    });

    canvas.on("mouse:move", (opt) => {
      if (!isDrawingRef.current || !startPointRef.current || !opt.pointer) return;
      const temp = canvas.getObjects().find((o) => (o as any).isTemp);
      if (temp) canvas.remove(temp);

      const start = startPointRef.current;
      const w = opt.pointer.x - start.x;
      const h = opt.pointer.y - start.y;

      const rect = new Rect({
        left: w > 0 ? start.x : opt.pointer.x,
        top: h > 0 ? start.y : opt.pointer.y,
        width: Math.abs(w),
        height: Math.abs(h),
        fill: "rgba(0,0,0,0)",
        stroke: labelColorMap.get(selectedLabelId!) || "#00FF00",
        strokeWidth: 2,
        selectable: false,
        evented: false,
      });
      (rect as any).isTemp = true;
      canvas.add(rect);
      canvas.renderAll();
    });

    canvas.on("mouse:up", () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      startPointRef.current = null;

      const tempRects = canvas.getObjects().filter((o) => (o as any).isTemp);
      tempRects.forEach((t) => {
        const pos = { left: t.left!, top: t.top!, width: t.width || 1, height: t.height || 1 };
        if (pos.width < 5 || pos.height < 5) {
          canvas.remove(t);
          return;
        }
        canvas.remove(t);

        const color = labelColorMap.get(selectedLabelId!) || "#00FF00";
        const labelName = labelNameMap.get(selectedLabelId!) || "";
        const rect = new Rect({
          ...pos,
          fill: "rgba(0,0,0,0)",
          stroke: color,
          strokeWidth: 2,
          cornerColor: color,
          cornerSize: 8,
          transparentCorners: false,
        });
        (rect as any).labelId = selectedLabelId;
        (rect as any).annotationId = 0;

        const text = new FabricText(labelName, {
          left: pos.left,
          top: Math.max(0, pos.top! - 18),
          fontSize: 12,
          fill: "#fff",
          backgroundColor: color,
          padding: 2,
          selectable: false,
          evented: false,
        });
        (text as any).linkedRect = rect;
        (rect as any).linkedText = text;

        canvas.add(rect);
        canvas.add(text);
        canvas.setActiveObject(rect);
        canvas.renderAll();
        buildAnnotationsFromCanvas();
      });
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const active = canvas.getActiveObject();
        if (active) {
          const linkedText = (active as any).linkedText;
          if (linkedText) canvas.remove(linkedText);
          canvas.remove(active);
          canvas.renderAll();
          buildAnnotationsFromCanvas();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    canvas.on("object:modified", () => {
      const active = canvas.getActiveObject();
      if (active && (active as any).linkedText) {
        const text = (active as any).linkedText as FabricText;
        text.set({ left: active.left!, top: Math.max(0, active.top! - 18) });
      }
      buildAnnotationsFromCanvas();
      canvas.renderAll();
    });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      canvas.dispose();
    };
  }, [imageUrl]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setZoom(zoom);
    canvas.renderAll();
  }, [zoom]);

  return (
    <div className="relative flex-1 overflow-hidden bg-gray-950 flex items-center justify-center">
      <canvas ref={canvasRef} />
    </div>
  );
}
