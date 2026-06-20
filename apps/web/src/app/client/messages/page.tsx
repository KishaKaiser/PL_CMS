import { PrivateMessageInbox } from '../../../components/private-message-inbox';

export default function ClientMessagesPage() {
  return (
    <PrivateMessageInbox
      title="Messages"
      description="Send and receive private messages."
      backHref="/client"
    />
  );
}
