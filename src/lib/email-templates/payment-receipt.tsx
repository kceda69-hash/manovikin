import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

const SITE_NAME = "MANOVIK AI";
const BRAND = "#7c5cff";

interface ReceiptProps {
  name?: string;
  planLabel?: string;
  amountFormatted?: string;
  paymentId?: string;
  orderId?: string;
  receiptNo?: string;
  date?: string;
  receiptUrl?: string;
}

const PaymentReceiptEmail = ({
  name,
  planLabel = "MANOVIK Pro",
  amountFormatted = "₹0",
  paymentId = "—",
  orderId = "—",
  receiptNo = "—",
  date = new Date().toLocaleString(),
  receiptUrl = "https://manovikin.lovable.app/billing",
}: ReceiptProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} payment receipt — {amountFormatted}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Payment received</Heading>
        <Text style={text}>
          {name ? `Hi ${name}, ` : "Hi, "}thanks for your purchase. This email confirms your payment to {SITE_NAME}.
        </Text>

        <Section style={card}>
          <Row label="Plan" value={planLabel} />
          <Row label="Amount" value={amountFormatted} />
          <Row label="Date" value={date} />
          <Row label="Receipt no." value={receiptNo} />
          <Row label="Payment ID" value={paymentId} />
          <Row label="Order ID" value={orderId} />
        </Section>

        <Section style={{ textAlign: "center", margin: "28px 0" }}>
          <Button href={receiptUrl} style={button}>
            View &amp; download invoice
          </Button>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          This is a tax invoice for your records. If you have any questions, just reply to this email.
          <br />— The {SITE_NAME} team
        </Text>
      </Container>
    </Body>
  </Html>
);

function Row({ label, value }: { label: string; value: string }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <tbody>
        <tr>
          <td style={rowLabel}>{label}</td>
          <td style={rowValue}>{value}</td>
        </tr>
      </tbody>
    </table>
  );
}

export const template = {
  component: PaymentReceiptEmail,
  subject: (d: Record<string, any>) =>
    `Your ${SITE_NAME} receipt — ${d?.amountFormatted ?? ""}`.trim(),
  displayName: "Payment receipt",
  previewData: {
    name: "Jane",
    planLabel: "MANOVIK Pro (monthly)",
    amountFormatted: "₹499",
    paymentId: "pay_ABC123",
    orderId: "order_XYZ789",
    receiptNo: "mnv_pro_1730000000",
    date: new Date().toLocaleString(),
    receiptUrl: "https://manovikin.lovable.app/billing",
  },
} satisfies TemplateEntry;

const main: React.CSSProperties = {
  backgroundColor: "#ffffff",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};
const container: React.CSSProperties = { padding: "28px 24px", maxWidth: 560, margin: "0 auto" };
const h1: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: "#0b0b0f", margin: "0 0 16px" };
const text: React.CSSProperties = { fontSize: 14, color: "#3a3a44", lineHeight: 1.6, margin: "0 0 16px" };
const card: React.CSSProperties = {
  border: "1px solid #ececf2",
  borderRadius: 10,
  padding: "8px 14px",
  margin: "16px 0",
  backgroundColor: "#fafafd",
};
const rowLabel: React.CSSProperties = { fontSize: 12, color: "#6b6b78", padding: "8px 0", width: "40%" };
const rowValue: React.CSSProperties = { fontSize: 13, color: "#0b0b0f", padding: "8px 0", textAlign: "right", fontWeight: 600 };
const button: React.CSSProperties = {
  backgroundColor: BRAND,
  color: "#ffffff",
  padding: "12px 22px",
  borderRadius: 8,
  fontWeight: 600,
  textDecoration: "none",
  fontSize: 14,
  display: "inline-block",
};
const hr: React.CSSProperties = { borderColor: "#ececf2", margin: "24px 0" };
const footer: React.CSSProperties = { fontSize: 12, color: "#8a8a96", lineHeight: 1.6, margin: 0 };
