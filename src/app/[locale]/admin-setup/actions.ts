"use server";

import { z } from "zod";
import { toLocale } from "@/i18n";
import {
  AdminSetupRejected,
  confirmAdminAccount,
  requestAdminAccount,
  type AdminSetupError,
} from "@/server/services/adminSetup";

export type AdminSetupState =
  | { step: "request"; error?: AdminSetupError }
  | { step: "confirm"; inviteId: string; email: string; error?: AdminSetupError }
  | { step: "done"; email: string };

const requestSchema = z.object({
  locale: z.string().optional(),
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
  passwordRepeat: z.string().max(200),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
});

const confirmSchema = z.object({
  inviteId: z.string().min(1).max(64),
  email: z.string().max(200),
  code: z.string().trim().regex(/^\d{6}$/),
});

export async function requestAdminAction(
  _previous: AdminSetupState,
  formData: FormData,
): Promise<AdminSetupState> {
  const parsed = requestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { step: "request", error: "validation" };
  const data = parsed.data;

  try {
    const { inviteId } = await requestAdminAccount({
      email: data.email,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      password: data.password,
      passwordRepeat: data.passwordRepeat,
      locale: toLocale(data.locale ?? ""),
    });
    return { step: "confirm", inviteId, email: data.email.toLowerCase() };
  } catch (error) {
    if (error instanceof AdminSetupRejected) return { step: "request", error: error.code };
    throw error;
  }
}

export async function confirmAdminAction(
  previous: AdminSetupState,
  formData: FormData,
): Promise<AdminSetupState> {
  // "Start over" is the one submission on the confirm step without a code.
  if (formData.get("intent") === "restart") return { step: "request" };

  const parsed = confirmSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    if (previous.step === "confirm") return { ...previous, error: "codeInvalid" };
    return { step: "request", error: "validation" };
  }
  const { inviteId, email, code } = parsed.data;

  try {
    const result = await confirmAdminAccount(inviteId, code);
    return { step: "done", email: result.email };
  } catch (error) {
    if (!(error instanceof AdminSetupRejected)) throw error;
    // An expired or exhausted invite is gone: back to the form. A wrong
    // code keeps the step, and the remaining attempts.
    if (error.code === "codeExpired" || error.code === "emailTaken") {
      return { step: "request", error: error.code };
    }
    return { step: "confirm", inviteId, email, error: error.code };
  }
}
