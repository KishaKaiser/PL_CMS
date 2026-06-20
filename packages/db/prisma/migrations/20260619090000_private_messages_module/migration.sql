INSERT INTO modules (id, name, version, enabled, config, "createdAt", "updatedAt")
VALUES (
  'private_messages_module',
  'private-messages',
  '1.0.0',
  true,
  '{}',
  now(),
  now()
)
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON messages ("senderId");
CREATE INDEX IF NOT EXISTS messages_recipient_id_idx ON messages ("recipientId");
CREATE INDEX IF NOT EXISTS messages_sender_recipient_sent_at_idx ON messages ("senderId", "recipientId", "sentAt");
CREATE INDEX IF NOT EXISTS messages_recipient_read_at_idx ON messages ("recipientId", "readAt");
