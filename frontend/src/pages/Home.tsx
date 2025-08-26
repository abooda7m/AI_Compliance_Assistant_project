export default function Home() {
  return (
    <div className="container-max py-6">
      <div className="card">
        <div className="card-header">
          <h1 className="text-xl font-semibold text-gray-800">Welcome</h1>
        </div>
        <div className="card-body">
          <p className="mb-3">
            Use the navigation to ask questions, upload documents, check sensitivity, run audits, and generate policy plans.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            <li>
              <strong>QA:</strong> Ask questions about SDAIA regulations and get grounded answers with citations.
            </li>
            <li>
              <strong>Upload:</strong> Upload files to analyze in Sensitivity/Audit flows.
            </li>
            <li>
              <strong>Sensitivity:</strong> Detect PII via rules + LLM.
            </li>
            <li>
              <strong>Audit:</strong> Get compliance score and violations.
            </li>
            <li>
              <strong>Policies:</strong> Build a plan and (optionally) compose policy docs.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}