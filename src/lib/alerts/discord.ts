export async function sendDiscordWebhook(
  webhookUrl: string,
  content: string,
): Promise<void> {
  const url = webhookUrl.trim();
  if (!url) return;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: content.slice(0, 1900) }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Discord webhook failed: ${response.status} ${text}`);
  }
}
