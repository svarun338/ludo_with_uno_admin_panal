const dispatch = (msg, type) =>
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { msg, type } }));

export const toast = {
    success: msg => dispatch(msg, 'success'),
    warning: msg => dispatch(msg, 'warning'),  // amber — e.g. user deactivated
    error:   msg => dispatch(msg, 'error'),
};
