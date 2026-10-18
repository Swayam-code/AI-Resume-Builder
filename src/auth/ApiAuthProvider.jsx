import PropTypes from 'prop-types';
import { useLayoutEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { setApiTokenProvider } from '../../service/ApiClient';

export default function ApiAuthProvider({ children }) {
  const { getToken } = useAuth();
  useLayoutEffect(() => {
    setApiTokenProvider(getToken);
    return () => setApiTokenProvider(undefined);
  }, [getToken]);
  return children;
}

ApiAuthProvider.propTypes = { children: PropTypes.node };
