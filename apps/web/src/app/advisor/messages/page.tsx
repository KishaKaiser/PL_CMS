import { PrivateMessageInbox } from '../../../components/private-message-inbox';

export default function AdvisorMessagesPage() {
  return (
    <PrivateMessageInbox
      title="Messages"
      description="Your inbox: write to Support and to clients you have spoken with or who have booked or requested a call with you."
      backHref="/advisor"
    />
  );
}
