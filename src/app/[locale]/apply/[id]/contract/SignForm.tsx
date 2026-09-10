"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Alert, Button } from "@/components/ui";
import type { Dictionary } from "@/i18n";
import type { ActionState } from "../../actions";

/**
 * The signature pad.
 *
 * The borrower draws with whatever they have — mouse, finger or stylus.
 * Pointer events cover all three with one set of handlers, so there is no
 * separate touch path to keep in step, and `setPointerCapture` keeps the
 * stroke attached to the canvas when the hand drifts outside it mid-letter.
 *
 * The drawing is submitted as a PNG data URL in a hidden field. The server
 * decodes and re-checks it: the canvas is a convenience, never a validation
 * boundary.
 */
export function SignForm({
  dictionary,
  action,
  signerName,
}: {
  dictionary: Dictionary;
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  signerName: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);
  const t = dictionary.contract;

  // The canvas is sized in device pixels and scaled back down in CSS, so the
  // stroke is not a blurry upscale on a phone or a high-density display.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineWidth = 2.2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#0d005d";
  }, []);

  const positionOf = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    // Capture keeps the stroke attached when the hand drifts off the canvas.
    // Not every input source grants it, and failing to get it is no reason to
    // refuse the signature — so the drawing proceeds either way.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* capture is an improvement, not a requirement */
    }
    drawing.current = true;
    const { x, y } = positionOf(event);
    context.beginPath();
    context.moveTo(x, y);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    // Prevents the page scrolling under a finger mid-signature.
    event.preventDefault();
    const { x, y } = positionOf(event);
    context.lineTo(x, y);
    context.stroke();
    if (!hasStroke) setHasStroke(true);
  };

  const end = () => {
    drawing.current = false;
  };

  /**
   * Serialises at submit time rather than when the pointer lifts.
   *
   * A `pointerup` that never arrives — capture denied, the pointer released
   * outside the window, an input source that reports differently — would
   * otherwise leave the field empty and the signature silently lost. Reading
   * the canvas once, here, cannot miss: whatever is on it is what gets sent.
   */
  const serialise = () => {
    const canvas = canvasRef.current;
    if (canvas && hiddenRef.current) hiddenRef.current.value = canvas.toDataURL("image/png");
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (hiddenRef.current) hiddenRef.current.value = "";
    setHasStroke(false);
  };

  const errorMessage =
    state.error === "signatureRequired"
      ? t.signatureRequired
      : state.error === "signatureExpired"
        ? t.signatureExpired
        : state.error === "signatureTooLarge"
          ? t.signatureTooLarge
          : undefined;

  return (
    <form action={formAction} onSubmit={serialise} className="space-y-5">
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {state.error === "consentRequired" ? (
        <Alert tone="danger">{dictionary.errors.consentRequired}</Alert>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium">{t.drawLabel}</p>
        <p className="text-sm leading-relaxed text-[var(--muted)]">{t.drawHint}</p>

        <div className="relative">
          <canvas
            ref={canvasRef}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            aria-label={t.drawLabel}
            className="h-44 w-full touch-none rounded-[var(--radius-md)] border-2 border-dashed border-[var(--border-strong)] bg-[var(--surface)]"
          />
          {/* A ruled line and the signer's name, as on paper — it tells the
              borrower where to sign without covering what they draw. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-6 bottom-7 border-b border-[var(--border)]" />
          <span aria-hidden className="pointer-events-none absolute bottom-2 left-6 text-xs text-[var(--muted)]">
            {signerName}
          </span>
          {!hasStroke ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[var(--muted)]"
            >
              {t.drawPlaceholder}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={clear}
          className="text-sm underline underline-offset-2 disabled:opacity-50"
          disabled={!hasStroke}
        >
          {t.drawClear}
        </button>
      </div>

      <input ref={hiddenRef} type="hidden" name="signature" />

      <div className="flex gap-3">
        <input
          type="checkbox"
          id="consent_PRECONTRACTUAL_INFO"
          name="consent_PRECONTRACTUAL_INFO"
          required
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
        />
        <label htmlFor="consent_PRECONTRACTUAL_INFO" className="text-sm leading-relaxed">
          {dictionary.consent.precontractual_info}
        </label>
      </div>

      <Button type="submit" disabled={pending || !hasStroke}>
        {pending ? dictionary.common.loading : t.signCta}
      </Button>
    </form>
  );
}
