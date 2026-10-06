// Glowing hand cursor that tracks the index fingertip.
// Ref-driven: the page updates transform/mode directly on the DOM node so
// the cursor can move at camera frame rate without re-rendering React.
import { forwardRef } from "react";

export const HandCursor = forwardRef<HTMLDivElement>(function HandCursor(_, ref) {
  return (
    <div ref={ref} className="gd-cursor" data-mode="default" style={{ opacity: 0 }} aria-hidden="true">
      <div className="gd-cursor-ring" />
      <div className="gd-cursor-dot" />
    </div>
  );
});
