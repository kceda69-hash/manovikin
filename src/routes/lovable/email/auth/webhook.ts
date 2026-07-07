import * as React from 'react'
import { render } from '@react-email/render'
import { parseEmailWebhookPayload } from '@lovable.dev/email-js'
import { WebhookError, verifyWebhookRequest } from '@lovable.dev/webhooks-js'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { SignupEmail } from '@/lib/email-templates/signup'
import { InviteEmail } from '@/lib/email-templates/invite'
import { MagicLinkEmail } from '@/lib/email-templates/magic-link'
import { RecoveryEmail } from '@/lib/email-templates/recovery'
import { EmailChangeEmail } from '@/lib/email-templates/email-change'
import { ReauthenticationEmail } from '@/lib/email-templates/reauthentication'
import {
  AUTH_TEMPLATE_SCHEMAS,
  type AuthTemplateName,
} from '@/lib/email-templates/schemas'

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'Confirm your email',
  invite: "You've been invited",
  magiclink: 'Your login link',
  recovery: 'Reset your password',
  email_change: 'Confirm your new email',
  reauthentication: 'Your verification code',
}

// Template mapping
const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

// Configuration
const SITE_NAME = "manovikin"
const SENDER_DOMAIN = "notify.manovik.in"
const ROOT_DOMAIN = "manovik.in"
const FROM_DOMAIN = "manovik.in"

function redactEmail(email: string | null | undefined): string {
  if (!email) return '***'
  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return '***'
  return `${localPart[0]}***@${domain}`
}

export const Route = createFileRoute("/lovable/email/auth/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY

        if (!apiKey) {
          console.error('LOVABLE_API_KEY not configured')
          return Response.json(
            { error: 'Server configuration error' },
            { status: 500 }
          )
        }

        // Verify signature + timestamp, then parse payload.
        let payload: any
        let run_id = ''
        try {
          const verified = await verifyWebhookRequest({
            req: request,
            secret: apiKey,
            parser: parseEmailWebhookPayload,
          })
          payload = verified.payload
          run_id = payload.run_id
        } catch (error) {
          if (error instanceof WebhookError) {
            switch (error.code) {
              case 'invalid_signature':
              case 'missing_timestamp':
              case 'invalid_timestamp':
              case 'stale_timestamp':
                console.error('Invalid webhook signature', { error: error.message })
                return Response.json(
                  { error: 'Invalid signature' },
                  { status: 401 }
                )
              case 'invalid_payload':
              case 'invalid_json':
                console.error('Invalid webhook payload', { error: error.message })
                return Response.json(
                  { error: 'Invalid webhook payload' },
                  { status: 400 }
                )
            }
          }

          console.error('Webhook verification failed', { error })
          return Response.json(
            { error: 'Invalid webhook payload' },
            { status: 400 }
          )
        }

        if (!run_id) {
          console.error('Webhook payload missing run_id')
          return Response.json(
            { error: 'Invalid webhook payload' },
            { status: 400 }
          )
        }

        if (payload.version !== '1') {
          console.error('Unsupported payload version', { version: payload.version, run_id })
          return Response.json(
            { error: `Unsupported payload version: ${payload.version}` },
            { status: 400 }
          )
        }

        // The email action type is in payload.data.action_type (e.g., "signup", "recovery")
        // payload.type is the hook event type ("auth")
        const emailType = payload.data.action_type
        console.log('Received auth event', {
          emailType,
          email_redacted: redactEmail(payload.data.email),
          run_id,
        })

        const EmailTemplate = EMAIL_TEMPLATES[emailType]
        if (!EmailTemplate) {
          console.error('Unknown email type', { emailType, run_id })
          return Response.json(
            { error: `Unknown email type: ${emailType}` },
            { status: 400 }
          )
        }

        // Build template props from payload.data (HookData structure)
        const templateProps = {
          siteName: SITE_NAME,
          siteUrl: `https://${ROOT_DOMAIN}`,
          recipient: payload.data.email,
          confirmationUrl: payload.data.url,
          token: payload.data.token,
          email: payload.data.email,
          oldEmail: payload.data.old_email,
          newEmail: payload.data.new_email,
        }

        // Validate props against the auth-template schema so a compromised
        // upstream payload cannot inject unsafe values into the rendered email.
        const schema = AUTH_TEMPLATE_SCHEMAS[emailType as AuthTemplateName]
        if (schema) {
          const parsed = schema.safeParse(templateProps)
          if (!parsed.success) {
            console.error('Rejected auth email: template variables failed schema', {
              emailType,
              run_id,
              issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.code}`),
            })
            return Response.json(
              { error: 'Invalid template variables' },
              { status: 400 },
            )
          }
        }

        // Render React Email to HTML and plain text
        const element = React.createElement(EmailTemplate, templateProps)
        const html = await render(element)
        const text = await render(element, { plainText: true })

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseServiceKey) {
          console.error('Missing Supabase environment variables')
          return Response.json(
            { error: 'Server configuration error' },
            { status: 500 }
          )
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const messageId = crypto.randomUUID()
        const subject = EMAIL_SUBJECTS[emailType] || 'Notification'
        const fromAddr = `${SITE_NAME} <noreply@${FROM_DOMAIN}>`

        // Log pending BEFORE the send so we always have a record.
        await supabase.from('email_send_log').insert({
          message_id: messageId,
          template_name: emailType,
          recipient_email: payload.data.email,
          status: 'pending',
        })

        // Preferred path: Resend (when RESEND_API_KEY is configured).
        // Fallback: enqueue into the Lovable Emails pgmq queue.
        const resendKey = process.env.RESEND_API_KEY
        const lovableKey = process.env.LOVABLE_API_KEY

        async function sendViaResend(): Promise<{ ok: true } | { ok: false; error: string }> {
          if (!resendKey || !lovableKey) return { ok: false, error: 'resend_not_configured' }
          try {
            const res = await fetch(
              'https://connector-gateway.lovable.dev/resend/emails',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${lovableKey}`,
                  'X-Connection-Api-Key': resendKey,
                },
                body: JSON.stringify({
                  from: fromAddr,
                  to: [payload.data.email],
                  subject,
                  html,
                  text,
                  headers: { 'X-Entity-Ref-ID': messageId },
                }),
              },
            )
            if (!res.ok) {
              const body = await res.text()
              return { ok: false, error: `resend_${res.status}: ${body.slice(0, 200)}` }
            }
            return { ok: true }
          } catch (err) {
            return {
              ok: false,
              error: err instanceof Error ? err.message : 'resend_unknown',
            }
          }
        }

        const resendResult = await sendViaResend()

        if (resendResult.ok) {
          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: emailType,
            recipient_email: payload.data.email,
            status: 'sent',
          })
          console.log('Auth email sent via Resend', {
            emailType,
            email_redacted: redactEmail(payload.data.email),
            run_id,
          })
          return Response.json({ success: true, provider: 'resend' })
        }

        console.warn('Resend send failed, falling back to Lovable queue', {
          error: resendResult.error,
          run_id,
        })

        const { error: enqueueError } = await supabase.rpc('enqueue_email', {
          queue_name: 'auth_emails',
          payload: {
            run_id,
            message_id: messageId,
            to: payload.data.email,
            from: fromAddr,
            sender_domain: SENDER_DOMAIN,
            subject,
            html,
            text,
            purpose: 'transactional',
            label: emailType,
            queued_at: new Date().toISOString(),
          },
        })

        if (enqueueError) {
          console.error('Failed to enqueue auth email', { error: enqueueError, run_id, emailType })
          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: emailType,
            recipient_email: payload.data.email,
            status: 'failed',
            error_message: `resend_failed=${resendResult.error}; enqueue_failed=${enqueueError.message}`,
          })
          return Response.json(
            { error: 'Failed to send email' },
            { status: 500 }
          )
        }

        console.log('Auth email enqueued (Lovable fallback)', {
          emailType,
          email_redacted: redactEmail(payload.data.email),
          run_id,
        })

        return Response.json({ success: true, provider: 'lovable_queue' })
      },
    },
  },
})
