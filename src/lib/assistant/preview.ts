export function isAssistantPreviewHost(hostname: string) {
  return ['localhost', '127.0.0.1'].includes(hostname) || /^id-preview--[a-z0-9-]+\.lovable\.app$/i.test(hostname);
}
