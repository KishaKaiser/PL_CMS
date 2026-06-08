import { MediaLibrary } from '../../../components/admin/media-library';

export default function AdminMediaPage() {
  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Media</h1>
        <p className="mt-1 text-sm text-gray-600">
          Upload, browse, and reuse shared media assets across pages and posts.
        </p>
      </div>

      <MediaLibrary
        title="Media Library"
        description="Manage shared uploads for featured images and content embeds."
      />
    </div>
  );
}
