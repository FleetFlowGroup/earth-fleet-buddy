import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const feedbackSchema = z.object({
  companyId: z.string().uuid(),
  category: z.enum(["contact", "feedback", "bug", "improvement"]),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(4000),
  contactEmail: z.string().trim().email().max(320).optional().or(z.literal("")),
});

export const submitAppFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => feedbackSchema.parse(input))
  .handler(async ({ data, context }) => {
    const fallbackEmail = typeof context.claims?.email === "string" ? context.claims.email : "";
    const contactEmail = data.contactEmail || fallbackEmail;

    const { data: insertedRow, error } = await (context.supabase as any)
      .from("app_feedback")
      .insert({
        company_id: data.companyId,
        user_id: context.userId,
        category: data.category,
        subject: data.subject,
        message: data.message,
        contact_email: contactEmail,
      } as any)
      .select("id, created_at")
      .single();

    if (error) throw new Error(error.message);
    const inserted = insertedRow as { id: string; created_at: string };

    const { data: company } = await (context.supabase as any)
      .from("companies")
      .select("name")
      .eq("id", data.companyId)
      .maybeSingle();

    try {
      const { sendTransactionalServer } = await import("@/lib/email/send-server");
      await sendTransactionalServer({
        templateName: "app-feedback-notification",
        idempotencyKey: `app-feedback-${inserted.id}`,
        templateData: {
          category: data.category,
          subject: data.subject,
          message: data.message,
          companyName: (company as any)?.name ?? "",
          userEmail: fallbackEmail,
          contactEmail,
          submittedAt: inserted.created_at,
          feedbackId: inserted.id,
        },
      });
    } catch (emailError) {
      console.error("feedback notify email failed", emailError);
    }

    return { id: inserted.id, createdAt: inserted.created_at };
  });