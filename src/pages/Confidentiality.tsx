import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export default function Confidentiality() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1d21] text-white">
      {/* Header */}
      <div className="p-4 flex items-center justify-between sticky top-0 bg-[#1a1d21] z-10 border-b border-gray-800">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-lg">Confidentiality Agreement</h2>
        <div className="w-10" />
      </div>

      <div className="p-6 overflow-y-auto">
        <div className="prose prose-invert max-w-none text-sm text-gray-400 leading-relaxed space-y-6">
          <p>
            This Privacy Policy describes Our policies and procedures on the collection, use and disclosure of Your information when You use the Service and tells You about Your privacy rights and how the law protects You.
          </p>

          <section>
            <h3 className="text-white font-bold text-base mb-2">Interpretation and Definitions</h3>
            <h4 className="text-white font-bold text-sm mb-1">Interpretation</h4>
            <p>
              The words of which the initial letter is capitalized have meanings defined under the following conditions. The following definitions shall have the same meaning regardless of whether they appear in singular or in plural.
            </p>
          </section>

          <section>
            <h4 className="text-white font-bold text-sm mb-1">Definitions</h4>
            <p className="mb-4">For the purposes of this Privacy Policy:</p>
            <ul className="space-y-4 list-none p-0">
              <li>
                <strong className="text-white">You</strong> means the individual accessing or using the Service, or the company, or other legal entity on behalf of which such individual is accessing or using the Service, as applicable.
              </li>
              <li>
                <strong className="text-white">Company</strong> (referred to as either "the Company", "We", "Us" or "Our" in this Agreement) refers to JALWA 369.
              </li>
              <li>
                <strong className="text-white">Affiliate</strong> means an entity that controls, is controlled by or is under common control with a party, where "control" means ownership of 50% or more of the shares, equity interest or other securities entitled to vote for election of directors or other managing authority.
              </li>
              <li>
                <strong className="text-white">Account</strong> means a unique account created for You to access our Service or parts of our Service.
              </li>
              <li>
                <strong className="text-white">Website</strong> refers to JALWA 369, accessible from JALWA 369.
              </li>
              <li>
                <strong className="text-white">Service</strong> refers to the Website.
              </li>
              <li>
                <strong className="text-white">Country</strong> refers to: Dhaka, Bangladesh.
              </li>
              <li>
                <strong className="text-white">Service Provider</strong> means any natural or legal person who processes the data on behalf of the Company. It refers to third-party companies or individuals employed by the Company to facilitate the Service, to provide the Service on behalf of the Company, to perform services related to the Service or to assist the Company in analyzing how the Service is used.
              </li>
              <li>
                <strong className="text-white">Third-party Social Media Service</strong> refers to any website or any social network website through which a User can log in or create an account to use the Service.
              </li>
              <li>
                <strong className="text-white">Personal Data</strong> is any information that relates to an identified or identifiable individual.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
