import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect } from 'react';
import { setUser } from '../features/auth/authSlice';
import { useMeQuery } from '../services/api';

export default function ProtectedRoute({ roles }) {
  const location = useLocation();
  const dispatch = useDispatch();
  const { accessToken, user } = useSelector((state) => state.auth);
  const { data, isFetching } = useMeQuery(undefined, { skip: !accessToken });

  useEffect(() => {
    if (data?.data?.user) dispatch(setUser(data.data.user));
  }, [data, dispatch]);

  if (!accessToken) return <Navigate to="/login" state={{ from: location }} replace />;
  if (isFetching && !user) return <div className="p-8 text-sm text-slate-500">Loading session...</div>;
  if (roles?.length && user && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
