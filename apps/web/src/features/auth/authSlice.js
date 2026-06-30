import { createSlice } from '@reduxjs/toolkit';

const stored = (() => {
  try {
    return JSON.parse(localStorage.getItem('hfms_auth') || '{}');
  } catch {
    return {};
  }
})();

const initialState = {
  accessToken: stored.accessToken || null,
  refreshToken: stored.refreshToken || null,
  user: stored.user || null
};

function persist(state) {
  const payload = { accessToken: state.accessToken, refreshToken: state.refreshToken, user: state.user };
  localStorage.setItem('hfms_auth', JSON.stringify(payload));
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action) {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.user = action.payload.user;
      persist(state);
    },
    setUser(state, action) {
      state.user = action.payload;
      persist(state);
    },
    logout(state) {
      state.accessToken = null;
      state.refreshToken = null;
      state.user = null;
      localStorage.removeItem('hfms_auth');
    }
  }
});

export const { setCredentials, setUser, logout } = authSlice.actions;
export const selectAuth = (state) => state.auth;
export const selectUser = (state) => state.auth.user;
export default authSlice.reducer;
