import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ResumeInfoContext } from '../context/ResumeInfoContext';
import ResumePreview from '../dashboard/resume/components/ResumePreview';
import GlobalApi from '../../service/GlobalApi';

export default function ViewResume() {
  const { resumeId } = useParams();
  const [resumeInfo, setResumeInfo] = useState();
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    GlobalApi.GetResumeById(resumeId).then(result => {
      if (active) setResumeInfo(result.data.data);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [resumeId]);
  if (error) return <p role="alert">Resume unavailable or you do not have access.</p>;
  if (!resumeInfo) return <p>Loading resume...</p>;
  return <ResumeInfoContext.Provider value={{ resumeInfo, setResumeInfo }}>
    <div className="max-w-4xl mx-auto p-6">
      <button type="button" onClick={() => window.print()}>Print / Save PDF</button>
      <ResumePreview />
    </div>
  </ResumeInfoContext.Provider>;
}
