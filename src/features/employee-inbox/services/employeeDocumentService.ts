import { supabase } from "../../../lib/supabase/client";

export type EmployeeDocumentType =
  | "payslip"
  | "warning"
  | "letter"
  | "contract"
  | "policy"
  | "announcement"
  | "leave"
  | "asset"
  | "performance"
  | "notice";

export type EmployeeDocumentStatus =
  | "unread"
  | "read"
  | "acknowledged"
  | "archived";

export type EmployeeDocumentRow = {
  id: string;
  organization_id: string;
  title: string;
  message: string | null;
  document_type: EmployeeDocumentType;
  file_bucket: string | null;
  file_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  requires_acknowledgement: boolean;
  is_confidential: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  metadata: Record<string, unknown>;
};

export type EmployeeDocumentRecipientRow = {
  id: string;
  organization_id: string;
  document_id: string;
  user_id: string;
  status: EmployeeDocumentStatus;
  delivered_at: string;
  read_at: string | null;
  acknowledged_at: string | null;
  archived_at: string | null;
  acknowledgement_note: string | null;
  created_at: string;
};

export type MyEmployeeDocument = EmployeeDocumentRecipientRow & {
  document: EmployeeDocumentRow;
};

export type EmployeeOption = {
  id: string;
  full_name: string | null;
  email: string | null;
  primary_role: string | null;
  department: string | null;
};

export type AdminDocumentDelivery = EmployeeDocumentRecipientRow & {
  document: EmployeeDocumentRow;
  user_name: string | null;
  user_email: string | null;
};

export type PayslipBatch = {
  id: string;
  organization_id: string;
  title: string;
  payroll_month: number;
  payroll_year: number;
  status: "draft" | "processing" | "delivered" | "partial_failed" | "failed";
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown>;
};

export type PayslipBatchItem = {
  id: string;
  organization_id: string;
  batch_id: string;
  user_id: string | null;
  employee_email: string | null;
  employee_name: string | null;
  document_id: string | null;
  file_name: string;
  file_path: string | null;
  match_status:
    | "pending"
    | "matched"
    | "unmatched"
    | "duplicate"
    | "delivered"
    | "failed";
  error_message: string | null;
  created_at: string;
};

export const DOCUMENT_TYPE_OPTIONS: Array<{
  value: EmployeeDocumentType;
  label: string;
}> = [
  { value: "payslip", label: "Payslip" },
  { value: "warning", label: "Warning" },
  { value: "letter", label: "HR Letter" },
  { value: "contract", label: "Contract" },
  { value: "policy", label: "Policy" },
  { value: "announcement", label: "Announcement" },
  { value: "leave", label: "Leave" },
  { value: "asset", label: "Asset" },
  { value: "performance", label: "Performance" },
  { value: "notice", label: "Notice" },
];

const MY_DOCUMENT_SELECT = `
  id,
  organization_id,
  document_id,
  user_id,
  status,
  delivered_at,
  read_at,
  acknowledged_at,
  archived_at,
  acknowledgement_note,
  created_at,
  document:employee_documents (
    id,
    organization_id,
    title,
    message,
    document_type,
    file_bucket,
    file_path,
    file_name,
    mime_type,
    size_bytes,
    requires_acknowledgement,
    is_confidential,
    created_by,
    created_at,
    updated_at,
    expires_at,
    metadata
  )
`;

export function documentTypeLabel(type: EmployeeDocumentType) {
  return DOCUMENT_TYPE_OPTIONS.find((item) => item.value === type)?.label ?? type;
}

export function makeEmployeeDocumentPath(params: {
  organizationId: string;
  documentId: string;
  fileName: string;
}) {
  const safeName = params.fileName.replace(/[^\w.\-()[\] ]+/g, "_");
  return `${params.organizationId}/${params.documentId}/${safeName}`;
}

export function makePayslipPath(params: {
  organizationId: string;
  payrollYear: number;
  payrollMonth: number;
  userIdOrMatchKey: string;
  fileName: string;
}) {
  const safeName = params.fileName.replace(/[^\w.\-()[\] ]+/g, "_");
  const month = String(params.payrollMonth).padStart(2, "0");
  return `${params.organizationId}/payslips/${params.payrollYear}-${month}/${params.userIdOrMatchKey}/${safeName}`;
}

export async function uploadEmployeeDocumentFile(params: {
  path: string;
  file: File;
}) {
  const { error } = await supabase.storage
    .from("employee-documents")
    .upload(params.path, params.file, {
      cacheControl: "3600",
      upsert: true,
      contentType: params.file.type || undefined,
    });

  if (error) throw error;
  return params.path;
}

export async function getMyDocuments(params?: {
  status?: EmployeeDocumentStatus | "all";
  documentType?: EmployeeDocumentType | "all";
}) {
  let query = supabase
    .from("employee_document_recipients")
    .select(MY_DOCUMENT_SELECT)
    .order("delivered_at", { ascending: false });

  if (params?.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as MyEmployeeDocument[];
  if (!params?.documentType || params.documentType === "all") return rows;
  return rows.filter((row) => row.document.document_type === params.documentType);
}

export async function getDocumentById(recipientId: string) {
  const { data, error } = await supabase
    .from("employee_document_recipients")
    .select(MY_DOCUMENT_SELECT)
    .eq("id", recipientId)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as MyEmployeeDocument | null;
}

export async function getSignedDocumentUrl(document: EmployeeDocumentRow) {
  if (!document.file_path) return null;
  const { data, error } = await supabase.storage
    .from(document.file_bucket ?? "employee-documents")
    .createSignedUrl(document.file_path, 60 * 5, {
      download: false,
    });

  if (error) throw error;
  return data.signedUrl;
}

export async function logDocumentAudit(params: {
  organizationId: string;
  documentId: string;
  recipientId: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("employee_document_audit_logs").insert({
    organization_id: params.organizationId,
    document_id: params.documentId,
    recipient_id: params.recipientId,
    actor_user_id: userData.user?.id ?? null,
    action: params.action,
    metadata: params.metadata ?? {},
  });

  if (error) throw error;
}

export async function markDocumentRead(row: MyEmployeeDocument) {
  if (row.status !== "unread") return;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("employee_document_recipients")
    .update({ status: "read", read_at: now })
    .eq("id", row.id);

  if (error) throw error;
  await logDocumentAudit({
    organizationId: row.organization_id,
    documentId: row.document_id,
    recipientId: row.id,
    action: "document_read",
  });
}

export async function acknowledgeDocument(row: MyEmployeeDocument, note?: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("employee_document_recipients")
    .update({
      status: "acknowledged",
      read_at: row.read_at ?? now,
      acknowledged_at: now,
      acknowledgement_note: note?.trim() || null,
    })
    .eq("id", row.id);

  if (error) throw error;
  await logDocumentAudit({
    organizationId: row.organization_id,
    documentId: row.document_id,
    recipientId: row.id,
    action: "document_acknowledged",
    metadata: { note: note?.trim() || null },
  });
}

export async function archiveDocument(row: MyEmployeeDocument) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("employee_document_recipients")
    .update({ status: "archived", archived_at: now })
    .eq("id", row.id);

  if (error) throw error;
  await logDocumentAudit({
    organizationId: row.organization_id,
    documentId: row.document_id,
    recipientId: row.id,
    action: "document_archived",
  });
}

export async function downloadDocument(row: MyEmployeeDocument) {
  const url = await getSignedDocumentUrl(row.document);
  if (!url) throw new Error("This document has no file attached.");
  await logDocumentAudit({
    organizationId: row.organization_id,
    documentId: row.document_id,
    recipientId: row.id,
    action: "document_downloaded",
  });
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function getEmployeeOptions(organizationId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, primary_role, department")
    .eq("organization_id", organizationId)
    .neq("account_status", "deleted")
    .order("full_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as EmployeeOption[];
}

export async function sendDocumentToRecipients(params: {
  documentId: string;
  organizationId: string;
  title: string;
  message?: string | null;
  documentType: EmployeeDocumentType;
  filePath?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  requiresAcknowledgement: boolean;
  isConfidential: boolean;
  recipientUserIds: string[];
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await supabase.functions.invoke(
    "send-employee-documents",
    {
      body: params,
    },
  );

  if (error) throw error;
  return data as { ok: boolean; documentId: string; delivered: number };
}

export async function getAdminDocumentDeliveries(organizationId: string) {
  const { data, error } = await supabase
    .from("employee_document_recipients")
    .select(`${MY_DOCUMENT_SELECT}, profiles:user_id (full_name, email)`)
    .eq("organization_id", organizationId)
    .order("delivered_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  return ((data ?? []) as unknown[]).map((row) => {
    const item = row as MyEmployeeDocument & {
      profiles?: { full_name: string | null; email: string | null } | null;
    };
    return {
      ...item,
      user_name: item.profiles?.full_name ?? null,
      user_email: item.profiles?.email ?? null,
    };
  }) as AdminDocumentDelivery[];
}

export async function createPayslipBatch(params: {
  organizationId: string;
  title: string;
  payrollMonth: number;
  payrollYear: number;
  createdBy: string;
}) {
  const { data, error } = await supabase
    .from("payslip_batches")
    .insert({
      organization_id: params.organizationId,
      title: params.title,
      payroll_month: params.payrollMonth,
      payroll_year: params.payrollYear,
      created_by: params.createdBy,
      status: "draft",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as PayslipBatch;
}

function normalizeMatchText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9@.]+/g, " ")
    .trim();
}

export function matchPayslipFiles(files: File[], employees: EmployeeOption[]) {
  return files.map((file) => {
    const name = normalizeMatchText(file.name);
    const matches = employees.filter((employee) => {
      const email = normalizeMatchText(employee.email);
      const fullName = normalizeMatchText(employee.full_name);
      const compactName = fullName.replaceAll(" ", "");
      return (
        (!!email && name.includes(email)) ||
        (!!fullName && name.includes(fullName)) ||
        (!!compactName && name.replaceAll(" ", "").includes(compactName))
      );
    });

    const matchStatus: PayslipBatchItem["match_status"] =
      matches.length === 1
        ? "matched"
        : matches.length > 1
          ? "duplicate"
          : "unmatched";

    return {
      file,
      employee: matches.length === 1 ? matches[0] : null,
      matchStatus,
      errorMessage:
        matches.length === 1
          ? null
          : matches.length > 1
            ? "More than one employee matched this filename."
            : "No employee matched this filename.",
    };
  });
}

export async function createPayslipBatchItem(params: {
  organizationId: string;
  batchId: string;
  userId: string | null;
  employeeEmail?: string | null;
  employeeName?: string | null;
  fileName: string;
  filePath: string;
  matchStatus: PayslipBatchItem["match_status"];
  errorMessage?: string | null;
}) {
  const { data, error } = await supabase
    .from("payslip_batch_items")
    .insert({
      organization_id: params.organizationId,
      batch_id: params.batchId,
      user_id: params.userId,
      employee_email: params.employeeEmail ?? null,
      employee_name: params.employeeName ?? null,
      file_name: params.fileName,
      file_path: params.filePath,
      match_status: params.matchStatus,
      error_message: params.errorMessage ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as PayslipBatchItem;
}

export async function getPayslipBatchItems(batchId: string) {
  const { data, error } = await supabase
    .from("payslip_batch_items")
    .select("*")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as PayslipBatchItem[];
}

export async function deliverPayslipBatch(batchId: string) {
  const { data, error } = await supabase.functions.invoke(
    "deliver-payslip-batch",
    { body: { batchId } },
  );

  if (error) throw error;
  return data as { ok: boolean; delivered: number; failed: number };
}
