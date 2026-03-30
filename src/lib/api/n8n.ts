export type TriggerN8NFlowInput = {
  webhookUrl: string;
  payload?: Record<string, any>;
};

export type TriggerN8NFlowResult = {
  ok: boolean;
  status: number;
  data: any;
  error?: string;
};

export async function triggerN8NFlow({
  webhookUrl,
  payload = {},
}: TriggerN8NFlowInput): Promise<TriggerN8NFlowResult> {
  if (!webhookUrl) {
    throw new Error("Missing n8n webhook URL.");
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    let data: any = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data,
        error:
          data?.message || `n8n webhook failed with status ${response.status}`,
      };
    }

    return {
      ok: true,
      status: response.status,
      data,
    };
  } catch (error: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: error?.message || "Failed to reach n8n webhook.",
    };
  }
}
