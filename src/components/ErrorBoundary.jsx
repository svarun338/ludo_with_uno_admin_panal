import { Component } from 'react';

export default class ErrorBoundary extends Component {
    state = { hasError: false, error: null };

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('[ErrorBoundary]', error, info);
    }

    reset = () => this.setState({ hasError: false, error: null });

    render() {
        if (!this.state.hasError) return this.props.children;
        return (
            <div className='min-h-screen flex items-center justify-center bg-slate-50 px-4'>
                <div className='bg-white rounded-2xl p-8 max-w-md w-full shadow-sm border border-slate-100 text-center'>
                    <div className='w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4'>
                        <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' stroke='#ef4444' className='w-7 h-7'>
                            <circle cx='12' cy='12' r='10'/>
                            <line x1='12' y1='8' x2='12' y2='12'/><line x1='12' y1='16' x2='12.01' y2='16'/>
                        </svg>
                    </div>
                    <h2 className='text-lg font-bold text-slate-900 mb-1'>Something went wrong</h2>
                    <p className='text-sm text-slate-500 mb-5'>
                        {this.state.error?.message || 'An unexpected error occurred.'}
                    </p>
                    <button
                        onClick={this.reset}
                        className='h-10 px-6 bg-indigo-500 text-white text-sm font-semibold rounded-xl hover:bg-indigo-600 transition-colors'
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }
}
