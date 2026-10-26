import { defineApp } from '@vectoragents/vs-apps';

/** Model slots the space manager points at a model; the server asks for a slot, never a model. */
export const CSR_MODEL_SLOTS = {
  conversationSummary: 'conversation-summary',
  workflowConversation: 'workflow-conversation',
} as const;

/** One slot per channel, each filled by a connector of that service. */
export const CSR_CHANNEL_SLOTS = {
  whatsapp: 'whatsapp',
  messenger: 'messenger',
} as const;

/** Handlers a space admin routes a channel connector's event types to. */
export const CSR_CONNECTOR_HANDLERS = {
  inboundMessage: 'inbound-message',
  messageStatus: 'message-status',
} as const;

const inboundMessageHandler = {
  key: CSR_CONNECTOR_HANDLERS.inboundMessage,
  label: 'Inbound message',
  description: 'A customer message continues or opens a conversation.',
  defaultEventTypes: ['message.received'],
  singleEventType: true,
};

const messageStatusHandler = {
  key: CSR_CONNECTOR_HANDLERS.messageStatus,
  label: 'Message status',
  description: 'Delivered and read receipts for replies.',
  defaultEventTypes: ['message.delivered', 'message.read'],
};

export const csrDefinition = defineApp({
  key: 'csr',
  name: 'Customer Support',
  version: '0.1.0',
  defaultPageKey: 'csr-dashboard',
  pages: [
    { key: 'csr-dashboard', label: 'Dashboard', path: '/csr/dashboard', capability: 'csr:read' },
    {
      key: 'csr-conversations',
      label: 'Conversations',
      path: '/csr/conversations',
      capability: 'csr:conversations:manage',
    },
    { key: 'csr-teams', label: 'Support Teams', path: '/csr/teams', capability: 'csr:teams:manage' },
  ],
  capabilities: [
    { key: 'csr:read', label: 'View Customer Support', effect: 'read' },
    { key: 'csr:conversations:manage', label: 'Manage Conversations', effect: 'write' },
    { key: 'csr:teams:manage', label: 'Manage Support Teams', effect: 'write' },
  ],
  resources: {
    models: [
      {
        key: CSR_MODEL_SLOTS.conversationSummary,
        label: 'Conversation summary',
        description: 'Summarizes support conversations for agents.',
        modality: 'chat',
        providers: ['ANTHROPIC', 'AZURE_OPENAI'],
        capabilities: ['structuredOutput'],
        required: true,
      },
      {
        key: CSR_MODEL_SLOTS.workflowConversation,
        label: 'Workflow conversation',
        description: 'Answers customers in workflow conversation nodes.',
        modality: 'chat',
        providers: ['ANTHROPIC', 'AZURE_OPENAI'],
        capabilities: ['toolCalling'],
        required: true,
      },
    ],
    connectors: [
      {
        key: CSR_CHANNEL_SLOTS.whatsapp,
        provider: 'META',
        label: 'WhatsApp',
        required: false,
        eventHandlers: [inboundMessageHandler, messageStatusHandler],
      },
      {
        key: CSR_CHANNEL_SLOTS.messenger,
        provider: 'META',
        label: 'Messenger',
        required: false,
        eventHandlers: [inboundMessageHandler, messageStatusHandler],
      },
    ],
  },
});
