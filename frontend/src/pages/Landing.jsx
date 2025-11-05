import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, AlertTriangle, Navigation, TrendingUp, Shield, Phone, ArrowRight, Zap, Activity } from 'lucide-react';

const Landing = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  const featureCards = [
    { icon: <Navigation className="w-7 h-7" />, title: 'Traffic Updates', text: 'Live road status and congestion levels.', color: 'from-red-500 to-orange-500' },
    { icon: <AlertTriangle className="w-7 h-7" />, title: 'Flood Alerts', text: 'Real-time flood and hazard warnings.', color: 'from-blue-500 to-cyan-500' },
    { icon: <TrendingUp className="w-7 h-7" />, title: 'Roadwork Insights', text: 'Planned works and reroute suggestions.', color: 'from-purple-500 to-pink-500' },
    { icon: <MapPin className="w-7 h-7" />, title: 'City-wide Mapping', text: 'Clear, responsive map for quick checks.', color: 'from-green-500 to-emerald-500' },
    { icon: <Shield className="w-7 h-7" />, title: 'Emergency Ready', text: 'Fast access to response channels.', color: 'from-yellow-500 to-amber-500' },
  ];

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    
    window.addEventListener('scroll', onScroll);
    
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-x-hidden">
      {/* Animated Background Grid */}
      <div className="fixed inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(139, 0, 0, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 0, 0, 0.3) 1px, transparent 1px)',
          backgroundSize: '100px 100px',
          animation: 'gridPulse 4s ease-in-out infinite'
        }} />
      </div>

      {/* Floating Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-900/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-yellow-600/20 rounded-full blur-3xl animate-float-delayed" />
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(50px, -50px) scale(1.1); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-50px, 50px) scale(1.1); }
        }
        @keyframes gridPulse {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.4; }
        }
        .animate-float { animation: float 8s ease-in-out infinite; }
        .animate-float-delayed { animation: float-delayed 8s ease-in-out infinite 2s; }
      `}</style>

      {/* Glass Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-gradient-to-br from-slate-800/70 via-slate-900/60 to-slate-950/70 backdrop-blur-2xl border-b border-white/20 shadow-lg shadow-black/50' : 'bg-gradient-to-br from-slate-800/30 via-slate-900/20 to-slate-950/30 backdrop-blur-xl border-b border-white/5'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-3 group">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-bold shadow-lg shadow-red-900/50 group-hover:shadow-red-900/80 transition-all duration-300 group-hover:scale-110">
                  <Activity className="w-6 h-6" />
                </div>
                <div className="absolute -inset-1 bg-gradient-to-br from-red-600 to-yellow-500 rounded-2xl blur opacity-30 group-hover:opacity-60 transition-opacity" />
              </div>
              <div>
                <div className="font-black tracking-tight text-xl bg-gradient-to-r from-red-400 to-yellow-400 bg-clip-text text-transparent">Perpetual Traffic</div>
                <div className="text-xs text-slate-400 font-medium">Smart City System</div>
              </div>
            </div>
            <nav className="hidden md:flex items-center space-x-1">
              {['Home', 'About', 'Features', 'Contact'].map((item) => (
                <a key={item} href={`#${item.toLowerCase()}`} className="px-4 py-2 rounded-xl hover:bg-white/5 transition-all font-medium text-sm">
                  {item}
                </a>
              ))}
              <Link to="/explore" className="ml-2 px-6 py-2.5 rounded-xl font-semibold bg-white/10 border border-white/20 hover:bg-white/20 transition-all duration-300">Explore Map</Link>
              <Link to="/login" className="ml-2 px-6 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-yellow-400 to-yellow-500 text-slate-900 hover:shadow-lg hover:shadow-yellow-500/50 transition-all duration-300 hover:scale-105">
                Login
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="home" className="relative min-h-screen flex items-center justify-center pt-20">
        <div className="relative z-10 px-4 sm:px-6 max-w-7xl mx-auto w-full">
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-red-900/30 border border-red-500/30 mb-6 backdrop-blur-sm">
              <Zap className="w-4 h-4 mr-2 text-yellow-400" />
              <span className="text-sm font-medium text-yellow-400">Live Traffic Intelligence</span>
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black mb-6 leading-tight">
              <span className="block bg-gradient-to-r from-white via-red-200 to-yellow-200 bg-clip-text text-transparent">Las Piñas</span>
              <span className="block text-white">Traffic Command</span>
            </h1>
            
            <p className="max-w-2xl mx-auto text-slate-300 text-lg sm:text-xl mb-10 leading-relaxed">
              Next-generation traffic management powered by real-time data, AI insights, and community-driven intelligence
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/explore" className="group relative px-8 py-4 rounded-2xl font-bold bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 transition-all duration-300 hover:scale-105 shadow-xl shadow-red-900/50 hover:shadow-red-800/70">
                <span className="flex items-center">
                  Explore Live Map
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
              <Link to="/login" className="px-8 py-4 rounded-2xl font-semibold bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300">Login</Link>
              <a href="#about" className="px-8 py-4 rounded-2xl font-semibold bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300">
                Discover More
              </a>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            {[
              { label: 'Active Monitors', value: '24/7', icon: <Activity /> },
              { label: 'Response Time', value: '<2min', icon: <Zap /> },
              { label: 'Coverage', value: '100%', icon: <Shield /> }
            ].map((stat, i) => (
              <div key={i} className="group relative p-6 rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-white/10 hover:border-red-500/50 transition-all duration-300 hover:scale-105">
                <div className="absolute inset-0 bg-gradient-to-br from-red-600/5 to-yellow-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-black bg-gradient-to-r from-red-400 to-yellow-400 bg-clip-text text-transparent">{stat.value}</div>
                    <div className="text-slate-400 font-medium mt-1">{stat.label}</div>
                  </div>
                  <div className="text-red-500 opacity-50 group-hover:opacity-100 transition-opacity">{stat.icon}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Map Preview */}
      <section className="relative py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-black mb-4">
                <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Peek the Live Map</span>
              </h2>
              <p className="text-slate-300 text-lg leading-relaxed">
                Get a quick preview of real-time traffic conditions around Las Piñas.
                Open the full map to search routes, view incidents, and more.
              </p>
              <div className="mt-6">
                <Link to="/explore" className="inline-flex items-center px-6 py-3 rounded-2xl font-semibold bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 transition-all duration-300 hover:scale-105 shadow-lg shadow-red-900/50">
                  Open Live Map
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-red-600/20 to-yellow-600/20 rounded-3xl blur-3xl" />
              <div className="relative rounded-3xl border border-white/10 overflow-hidden shadow-2xl shadow-black/30 bg-slate-900">
                {/* 16:9 container */}
                <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                  <iframe
                    src="/explore"
                    title="Live Map Preview"
                    className="absolute inset-0 w-full h-full"
                    style={{ pointerEvents: 'none', filter: 'grayscale(15%) saturate(90%) brightness(0.95)' }}
                  />
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-slate-900/10 to-transparent pointer-events-none" />
                  <div className="absolute top-3 left-3">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 border border-white/20 backdrop-blur text-white">Live preview</span>
                  </div>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                    <Link to="/explore" className="px-5 py-2 rounded-xl font-semibold bg-white/90 text-slate-900 hover:bg-white transition-colors shadow">
                      Explore full map
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="relative py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-block px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/30 mb-6">
                <span className="text-sm font-bold text-yellow-400">Built with Excellence</span>
              </div>
              <h2 className="text-4xl sm:text-5xl font-black mb-6 leading-tight">
                <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Redefining Urban</span><br />
                <span className="text-red-400">Mobility Management</span>
              </h2>
              <p className="text-lg text-slate-300 leading-relaxed mb-6">
                A cutting-edge platform delivering real-time traffic intelligence, emergency alerts, and predictive analytics for Las Piñas City.
              </p>
              <p className="text-slate-400">
                Inspired by the excellence of University of Perpetual Help System DALTA, we bring institutional values into modern traffic solutions.
              </p>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-red-600/20 to-yellow-600/20 rounded-3xl blur-3xl" />
              <div className="relative p-8 rounded-3xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-white/10">
                <div className="flex items-start space-x-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center font-black text-2xl shadow-lg shadow-red-900/50">
                    UP
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-lg mb-2 text-yellow-400">Character Building is Nation Building</div>
                    <div className="text-slate-400 text-sm leading-relaxed">Our guiding principle in creating technology that serves communities with integrity and innovation.</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-8">
                  {['Real-time Data', 'AI-Powered', 'Community First', 'Always Secure'].map((tag, i) => (
                    <div key={i} className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-center text-sm font-semibold">
                      {tag}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Powerful Features</span>
            </h2>
            <p className="text-slate-400 text-lg">Everything you need for intelligent traffic management</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featureCards.map((f, i) => (
              <div key={i} className="group relative p-8 rounded-3xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-105">
                <div className="absolute inset-0 bg-gradient-to-br from-red-600/5 to-yellow-600/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                    {f.icon}
                  </div>
                  <h3 className="font-bold text-xl mb-3">{f.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 sm:py-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative p-12 rounded-3xl bg-gradient-to-br from-red-900/50 to-slate-900/50 backdrop-blur-xl border border-red-500/30 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-red-600/10 to-yellow-600/10" />
            <div className="relative text-center">
              <h2 className="text-3xl sm:text-4xl font-black mb-4">Ready to Experience Smarter Traffic?</h2>
              <p className="text-slate-300 text-lg mb-8 max-w-2xl mx-auto">Join hundreds of commuters and officials using our platform daily</p>
              <Link to="/explore" className="inline-flex items-center px-8 py-4 rounded-2xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-500 text-slate-900 hover:shadow-2xl hover:shadow-yellow-500/50 transition-all duration-300 hover:scale-105">
                Try the Live Map
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="relative border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-black text-xl">Perpetual Traffic</div>
                  <div className="text-slate-400 text-sm">Smart City Initiative</div>
                </div>
              </div>
              <p className="text-slate-400 leading-relaxed max-w-md">A next-generation traffic management system for Las Piñas, powered by University of Perpetual Help System DALTA innovation.</p>
            </div>
            
            <div>
              <div className="font-bold mb-4">Quick Links</div>
              <ul className="space-y-3">
                {['Home', 'About', 'Features', 'Contact'].map((link) => (
                  <li key={link}>
                    <a href={`#${link.toLowerCase()}`} className="text-slate-400 hover:text-yellow-400 transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <div className="font-bold mb-4">Get Started</div>
                <Link to="/explore" className="inline-flex items-center px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 font-semibold transition-all duration-300 hover:scale-105 shadow-lg shadow-red-900/50">
                Explore Map
                <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
            </div>
          </div>
          
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center">
            <div className="text-slate-400 text-sm mb-4 md:mb-0">
              © 2025 UPHSD BSCS-DS Students. All rights reserved.
            </div>
            <div className="text-yellow-400 font-semibold text-sm">
              Character Building is Nation Building
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;