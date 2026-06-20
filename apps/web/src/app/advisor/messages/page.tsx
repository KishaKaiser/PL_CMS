import { PrivateMessageInbox } from '../../../components/private-message-inbox';

export default function AdvisorMessagesPage() {
  return (
    <PrivateMessageInbox
      title="Messages"
      description="Send and receive private messages."
      backHref="/advisor"
    />
  );
}
