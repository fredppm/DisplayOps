import React from 'react';
import { NextPage } from 'next';
import Link from 'next/link';

const NewSitePage: NextPage = () => {
  return (
    <div className="container mx-auto p-4">
      <div className="mb-4">
        <Link href="/sites" className="text-blue-500 hover:underline">
          ← Back to Sites
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-6">Create New Site</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Site Name
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="e.g., Office Rio"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="e.g., Rio de Janeiro"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Timezone
            </label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-md">
              <option value="America/Sao_Paulo">America/Sao_Paulo</option>
              <option value="America/New_York">America/New_York</option>
              <option value="Europe/London">Europe/London</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Create Site
            </button>
            <Link
              href="/sites"
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewSitePage;