import React, { useState, useEffect } from 'react';
import {
  MapPin,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Download,
  RefreshCw,
  Filter,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Car,
  Navigation,
  Search,
  X,
  Info
} from 'lucide-react';
import adminService from '../services/adminService';
import toast from 'react-hot-toast';
import { MapContainer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import TomTomTileLayer from '../components/TomTomTileLayer';
import HeatmapLayer from '../components/HeatmapLayer';
import jsPDF from 'jspdf';

// Fix Leaflet default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const AdminTrafficReport = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState(7);
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedView, setSelectedView] = useState('overview'); // overview, barangay, roads, map

  useEffect(() => {
    fetchData();
  }, [days, selectedBarangay]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await adminService.getTrafficAreaStatistics(
        days,
        selectedBarangay || null
      );
      setData(result);
    } catch (error) {
      console.error('Error fetching traffic statistics:', error);
      toast.error('Failed to load traffic statistics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const exportToPDF = () => {
    if (!data) {
      toast.error('No data available to export');
      return;
    }

    try {
      toast.loading('Generating PDF report...', { id: 'pdf-export' });
      
      // Destructure data for easier access
      const { summary, by_barangay, top_congested_roads, traffic_status_distribution } = data;
      
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      let yPosition = margin;

      // Colors
      const primaryColor = [37, 99, 235]; // Blue
      const secondaryColor = [59, 130, 246]; // Light Blue
      const successColor = [34, 197, 94]; // Green
      const warningColor = [249, 115, 22]; // Orange
      const dangerColor = [239, 68, 68]; // Red
      const grayColor = [107, 114, 128]; // Gray

      // Helper function to add new page if needed
      const checkPageBreak = (requiredHeight) => {
        if (yPosition + requiredHeight > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      // Helper function to draw rounded rectangle
      const drawRoundedRect = (x, y, w, h, r, color, fill = true) => {
        doc.setFillColor(...color);
        doc.setDrawColor(...color);
        doc.roundedRect(x, y, w, h, r, r, fill ? 'F' : 'FD');
      };

      // Helper function to add text with word wrap
      const addText = (text, x, y, maxWidth, fontSize = 10, align = 'left', color = [0, 0, 0]) => {
        doc.setFontSize(fontSize);
        doc.setTextColor(...color);
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, x, y, { align });
        return lines.length * (fontSize * 0.4);
      };

      // Header
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('Traffic Management System', margin, 20);
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text('Traffic Area Statistics Report', margin, 30);
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      const reportDate = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      doc.text(`Generated: ${reportDate}`, pageWidth - margin, 30, { align: 'right' });
      
      yPosition = 50;

      // Report Period
      const periodText = days === 1 ? 'Last 24 Hours' : 
                        days === 7 ? 'Last 7 Days' : 
                        days === 30 ? 'Last 30 Days' : 
                        `Last ${days} Days`;
      doc.setTextColor(...grayColor);
      doc.setFontSize(10);
      doc.text(`Report Period: ${periodText}`, margin, yPosition);
      if (selectedBarangay) {
        doc.text(`Barangay Filter: ${selectedBarangay}`, margin + 80, yPosition);
      }
      yPosition += 10;

      // Executive Summary Section
      checkPageBreak(30);
      doc.setFillColor(240, 240, 240);
      doc.roundedRect(margin, yPosition, contentWidth, 25, 3, 3, 'F');
      
      doc.setTextColor(...primaryColor);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Executive Summary', margin + 5, yPosition + 8);
      
      yPosition += 12;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      const summaryText = `This report provides comprehensive traffic analysis for Las Piñas City covering ${summary.total_monitored_areas} monitored areas. ` +
                         `The overall average congestion is ${summary.overall_avg_congestion}% with a total of ${(summary.total_vehicle_count / 1000).toFixed(1)}K vehicles tracked. ` +
                         `The most congested area is ${summary.most_congested_area || 'N/A'}.`;
      addText(summaryText, margin + 5, yPosition, contentWidth - 10, 10);
      yPosition += 20;

      // Key Statistics Cards
      checkPageBreak(50);
      const cardWidth = (contentWidth - 10) / 4;
      const cardHeight = 35;
      const cardSpacing = 5;

      // Card 1: Monitored Areas
      drawRoundedRect(margin, yPosition, cardWidth, cardHeight, 3, primaryColor);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text('Monitored Areas', margin + 5, yPosition + 8);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(summary.total_monitored_areas.toString(), margin + 5, yPosition + 20);

      // Card 2: Avg Congestion
      drawRoundedRect(margin + cardWidth + cardSpacing, yPosition, cardWidth, cardHeight, 3, warningColor);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Avg Congestion', margin + cardWidth + cardSpacing + 5, yPosition + 8);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(`${summary.overall_avg_congestion}%`, margin + cardWidth + cardSpacing + 5, yPosition + 20);

      // Card 3: Total Vehicles
      drawRoundedRect(margin + (cardWidth + cardSpacing) * 2, yPosition, cardWidth, cardHeight, 3, successColor);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Total Vehicles', margin + (cardWidth + cardSpacing) * 2 + 5, yPosition + 8);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(`${(summary.total_vehicle_count / 1000).toFixed(1)}K`, margin + (cardWidth + cardSpacing) * 2 + 5, yPosition + 20);

      // Card 4: Most Congested
      drawRoundedRect(margin + (cardWidth + cardSpacing) * 3, yPosition, cardWidth, cardHeight, 3, dangerColor);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Most Congested', margin + (cardWidth + cardSpacing) * 3 + 5, yPosition + 8);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      const mostCongestedText = summary.most_congested_area || 'N/A';
      addText(mostCongestedText, margin + (cardWidth + cardSpacing) * 3 + 5, yPosition + 20, cardWidth - 10, 11);

      yPosition += cardHeight + 15;

      // Traffic Status Distribution
      checkPageBreak(40);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(margin, yPosition, contentWidth, 35, 3, 3, 'F');
      
      doc.setTextColor(...primaryColor);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Traffic Status Distribution', margin + 5, yPosition + 8);
      
      yPosition += 12;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const statusColors = {
        'FREE_FLOW': successColor,
        'SLOW': [234, 179, 8], // Yellow
        'CONGESTED': warningColor,
        'HEAVY': dangerColor
      };

      let xPos = margin + 5;
      Object.entries(traffic_status_distribution).forEach(([status, count], index) => {
        if (xPos > pageWidth - margin - 50) {
          yPosition += 8;
          xPos = margin + 5;
        }
        
        const statusColor = statusColors[status] || grayColor;
        doc.setFillColor(...statusColor);
        doc.circle(xPos + 3, yPosition, 2, 'F');
        
        doc.setTextColor(0, 0, 0);
        const statusLabel = status.replace('_', ' ').toLowerCase();
        doc.text(`${statusLabel}: ${count}`, xPos + 8, yPosition + 1);
        
        xPos += 60;
      });
      
      yPosition += 15;

      // Top 5 Barangays Table
      checkPageBreak(50);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(margin, yPosition, contentWidth, 8, 3, 3, 'F');
      
      doc.setTextColor(...primaryColor);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Top 5 Most Congested Barangays', margin + 5, yPosition + 6);
      yPosition += 12;

      // Table Header
      doc.setFillColor(...primaryColor);
      doc.roundedRect(margin, yPosition, contentWidth, 8, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('#', margin + 5, yPosition + 5.5);
      doc.text('Barangay', margin + 15, yPosition + 5.5);
      doc.text('Congestion', margin + 80, yPosition + 5.5);
      doc.text('Vehicles', margin + 120, yPosition + 5.5);
      doc.text('Status', margin + 160, yPosition + 5.5);
      yPosition += 10;

      // Table Rows
      doc.setFont('helvetica', 'normal');
      by_barangay?.slice(0, 5).forEach((barangay, index) => {
        checkPageBreak(8);
        if (index % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, yPosition - 2, contentWidth, 8, 'F');
        }
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.text((index + 1).toString(), margin + 5, yPosition + 5.5);
        doc.text(barangay.barangay, margin + 15, yPosition + 5.5);
        doc.text(`${barangay.avg_congestion}%`, margin + 80, yPosition + 5.5);
        doc.text(barangay.total_vehicles.toLocaleString(), margin + 120, yPosition + 5.5);
        
        // Status badge
        const statusColor = barangay.avg_congestion >= 80 ? dangerColor :
                           barangay.avg_congestion >= 60 ? warningColor :
                           barangay.avg_congestion >= 40 ? [234, 179, 8] : successColor;
        doc.setFillColor(...statusColor);
        doc.roundedRect(margin + 160, yPosition - 1, 30, 6, 1, 1, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text(barangay.status, margin + 175, yPosition + 4, { align: 'center' });
        
        yPosition += 8;
      });
      yPosition += 10;

      // Top Congested Roads
      checkPageBreak(50);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(margin, yPosition, contentWidth, 8, 3, 3, 'F');
      
      doc.setTextColor(...primaryColor);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Top Congested Roads', margin + 5, yPosition + 6);
      yPosition += 12;

      // Table Header
      doc.setFillColor(...primaryColor);
      doc.roundedRect(margin, yPosition, contentWidth, 8, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('#', margin + 5, yPosition + 5.5);
      doc.text('Road Name', margin + 15, yPosition + 5.5);
      doc.text('Barangay', margin + 80, yPosition + 5.5);
      doc.text('Congestion', margin + 130, yPosition + 5.5);
      doc.text('Speed', margin + 170, yPosition + 5.5);
      yPosition += 10;

      // Table Rows
      doc.setFont('helvetica', 'normal');
      top_congested_roads?.slice(0, 10).forEach((road, index) => {
        checkPageBreak(8);
        if (index % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, yPosition - 2, contentWidth, 8, 'F');
        }
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.text((index + 1).toString(), margin + 5, yPosition + 5.5);
        addText(road.road_name, margin + 15, yPosition + 5.5, 60, 9);
        addText(road.barangay, margin + 80, yPosition + 5.5, 45, 9);
        doc.text(`${road.congestion_percentage}%`, margin + 130, yPosition + 5.5);
        doc.text(`${road.avg_speed_kmh} km/h`, margin + 170, yPosition + 5.5);
        
        yPosition += 8;
      });
      yPosition += 10;

      // Footer on each page
      const addFooter = (pageNum, totalPages) => {
        const footerY = pageHeight - 10;
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
        doc.setTextColor(...grayColor);
        doc.setFontSize(8);
        doc.text(`Traffic Management System - Las Piñas City`, margin, footerY);
        doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
      };

      // Add footer to all pages
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addFooter(i, totalPages);
      }

      // Save PDF
      const fileName = `Traffic_Report_${periodText.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      toast.success('PDF report generated successfully!', { id: 'pdf-export' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF report', { id: 'pdf-export' });
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      LOW: 'bg-green-100 text-green-800 border-green-200',
      MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
      CRITICAL: 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[status] || colors.LOW;
  };

  const getCongestionColor = (percentage) => {
    if (percentage >= 80) return 'text-red-600';
    if (percentage >= 60) return 'text-orange-600';
    if (percentage >= 40) return 'text-yellow-600';
    return 'text-green-600';
  };

  const filteredBarangays = data?.by_barangay?.filter(b =>
    b.barangay.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const filteredRoads = data?.top_congested_roads?.filter(r =>
    r.road_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.barangay.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Data Available</h2>
          <p className="text-gray-600 mb-4">Unable to load traffic statistics</p>
          <button
            onClick={fetchData}
            className="btn btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { summary, by_barangay, top_congested_roads, traffic_status_distribution } = data;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
              <BarChart3 className="w-7 h-7 sm:w-8 sm:h-8 text-primary-600" />
              Traffic Area Statistics
            </h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              Comprehensive traffic analysis for Las Piñas City
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium"
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={exportToPDF}
              disabled={!data || loading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export PDF</span>
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Period (Days)
                </label>
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value={1}>Last 24 Hours</option>
                  <option value={7}>Last 7 Days</option>
                  <option value={30}>Last 30 Days</option>
                  <option value={90}>Last 90 Days</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Barangay Filter
                </label>
                <select
                  value={selectedBarangay}
                  onChange={(e) => setSelectedBarangay(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">All Barangays</option>
                  {by_barangay?.map((b) => (
                    <option key={b.barangay} value={b.barangay}>
                      {b.barangay}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSelectedBarangay('');
                    setDays(7);
                    setSearchTerm('');
                  }}
                  className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors text-sm font-medium"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-5 h-5 sm:w-6 sm:h-6 opacity-80" />
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 opacity-80" />
          </div>
          <p className="text-blue-100 text-xs sm:text-sm font-medium mb-1">Monitored Areas</p>
          <p className="text-2xl sm:text-3xl font-bold">{summary.total_monitored_areas}</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 opacity-80" />
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 opacity-80" />
          </div>
          <p className="text-orange-100 text-xs sm:text-sm font-medium mb-1">Avg Congestion</p>
          <p className="text-2xl sm:text-3xl font-bold">{summary.overall_avg_congestion}%</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Car className="w-5 h-5 sm:w-6 sm:h-6 opacity-80" />
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 opacity-80" />
          </div>
          <p className="text-green-100 text-xs sm:text-sm font-medium mb-1">Total Vehicles</p>
          <p className="text-2xl sm:text-3xl font-bold">
            {(summary.total_vehicle_count / 1000).toFixed(1)}K
          </p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <MapPin className="w-5 h-5 sm:w-6 sm:h-6 opacity-80" />
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 opacity-80" />
          </div>
          <p className="text-red-100 text-xs sm:text-sm font-medium mb-1">Most Congested</p>
          <p className="text-sm sm:text-base font-semibold truncate">
            {summary.most_congested_area || 'N/A'}
          </p>
        </div>
      </div>

      {/* View Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'barangay', label: 'By Barangay', icon: MapPin },
            { id: 'roads', label: 'Top Roads', icon: Navigation },
            { id: 'map', label: 'Map View', icon: Activity }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedView(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium ${
                  selectedView === tab.id
                    ? 'bg-primary-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Overview View */}
      {selectedView === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Traffic Status Distribution */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
              Traffic Status Distribution
            </h2>
            <div className="space-y-3">
              {Object.entries(traffic_status_distribution).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      status === 'FREE_FLOW' ? 'bg-green-500' :
                      status === 'SLOW' ? 'bg-yellow-500' :
                      status === 'CONGESTED' ? 'bg-orange-500' : 'bg-red-500'
                    }`} />
                    <span className="text-sm sm:text-base text-gray-700 capitalize">
                      {status.replace('_', ' ').toLowerCase()}
                    </span>
                  </div>
                  <span className="text-sm sm:text-base font-semibold text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top 5 Barangays */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
              Top 5 Most Congested Barangays
            </h2>
            <div className="space-y-3">
              {by_barangay?.slice(0, 5).map((barangay, index) => (
                <div
                  key={barangay.barangay}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-base font-medium text-gray-900 truncate">
                        {barangay.barangay}
                      </p>
                      <p className="text-xs text-gray-500">
                        {barangay.road_count} roads • {barangay.total_vehicles.toLocaleString()} vehicles
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-sm sm:text-base font-bold ${getCongestionColor(barangay.avg_congestion)}`}>
                      {barangay.avg_congestion}%
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(barangay.status)}`}>
                      {barangay.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Barangay View */}
      {selectedView === 'barangay' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              Barangay Statistics
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search barangay..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs sm:text-sm font-semibold text-gray-700">Barangay</th>
                  <th className="text-right py-3 px-4 text-xs sm:text-sm font-semibold text-gray-700">Avg Congestion</th>
                  <th className="text-right py-3 px-4 text-xs sm:text-sm font-semibold text-gray-700">Vehicles</th>
                  <th className="text-right py-3 px-4 text-xs sm:text-sm font-semibold text-gray-700">Roads</th>
                  <th className="text-right py-3 px-4 text-xs sm:text-sm font-semibold text-gray-700">Avg Speed</th>
                  <th className="text-center py-3 px-4 text-xs sm:text-sm font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredBarangays.map((barangay) => (
                  <tr
                    key={barangay.barangay}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span className="text-sm sm:text-base font-medium text-gray-900">
                          {barangay.barangay}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`text-sm sm:text-base font-semibold ${getCongestionColor(barangay.avg_congestion)}`}>
                        {barangay.avg_congestion}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-sm sm:text-base text-gray-700">
                      {barangay.total_vehicles.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-sm sm:text-base text-gray-700">
                      {barangay.road_count}
                    </td>
                    <td className="py-3 px-4 text-right text-sm sm:text-base text-gray-700">
                      {barangay.avg_speed_kmh ? `${barangay.avg_speed_kmh} km/h` : 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(barangay.status)}`}>
                        {barangay.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Roads View */}
      {selectedView === 'roads' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              Top Congested Roads
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search road..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRoads.map((road, index) => (
              <div
                key={road.road_name}
                className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </div>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                        {road.road_name}
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {road.barangay}
                    </p>
                  </div>
                  <span className={`text-lg sm:text-xl font-bold ${getCongestionColor(road.congestion_percentage)}`}>
                    {road.congestion_percentage}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                  <div>
                    <p className="text-gray-500 mb-1">Avg Speed</p>
                    <p className="font-semibold text-gray-900">{road.avg_speed_kmh} km/h</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Vehicles</p>
                    <p className="font-semibold text-gray-900">{road.vehicle_count.toLocaleString()}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500 mb-1">Peak Hours</p>
                    <p className="font-semibold text-gray-900">{road.peak_hours.join(', ')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Map View */}
      {selectedView === 'map' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                Traffic Density Map
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Interactive map showing traffic congestion across Las Piñas City
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg border border-green-200">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-gray-700">Low (0-40%)</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-gray-700">Medium (40-60%)</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-lg border border-orange-200">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span className="text-gray-700">High (60-80%)</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-lg border border-red-200">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-gray-700">Critical (80%+)</span>
              </div>
            </div>
          </div>
          <div className="h-96 sm:h-[600px] rounded-lg overflow-hidden border border-gray-200 relative">
            {data?.geographic_data && data.geographic_data.length > 0 ? (
              <MapContainer
                center={[14.4504, 121.0170]} // Las Piñas City center
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
                scrollWheelZoom={true}
              >
                <TomTomTileLayer />
                
                {/* Heatmap Layer */}
                {data.geographic_data.length > 0 && (
                  <HeatmapLayer
                    points={data.geographic_data.map(point => [
                      point.latitude,
                      point.longitude,
                      point.intensity
                    ])}
                    options={{
                      radius: 25,
                      blur: 15,
                      max: 1.0,
                      minOpacity: 0.4,
                      gradient: {
                        0.0: 'green',
                        0.3: 'yellow',
                        0.6: 'orange',
                        1.0: 'red'
                      }
                    }}
                  />
                )}

                {/* Markers for each traffic area */}
                {data.top_congested_roads?.map((road, index) => {
                  // Find corresponding geographic data point
                  const geoPoint = data.geographic_data?.find(
                    g => g.area_name === road.road_name
                  );
                  
                  if (!geoPoint) return null;
                  
                  const congestion = road.congestion_percentage;
                  let markerColor = '#22c55e'; // green
                  if (congestion >= 80) markerColor = '#ef4444'; // red
                  else if (congestion >= 60) markerColor = '#f97316'; // orange
                  else if (congestion >= 40) markerColor = '#eab308'; // yellow
                  
                  // Create custom icon
                  const customIcon = L.divIcon({
                    className: 'custom-traffic-marker',
                    html: `
                      <div style="
                        background-color: ${markerColor};
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        border: 3px solid white;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        color: white;
                        font-size: 10px;
                      ">${index + 1}</div>
                    `,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                  });
                  
                  return (
                    <Marker
                      key={road.road_name}
                      position={[geoPoint.latitude, geoPoint.longitude]}
                      icon={customIcon}
                    >
                      <Popup>
                        <div className="p-3 min-w-[200px]">
                          <div className="flex items-center gap-2 mb-2">
                            <div 
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: markerColor }}
                            ></div>
                            <h3 className="font-bold text-base text-gray-900">
                              {road.road_name}
                            </h3>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Barangay:</span>
                              <span className="font-medium text-gray-900">{road.barangay}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Congestion:</span>
                              <span className={`font-bold ${getCongestionColor(congestion)}`}>
                                {congestion}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Avg Speed:</span>
                              <span className="font-medium text-gray-900">
                                {road.avg_speed_kmh} km/h
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Vehicles:</span>
                              <span className="font-medium text-gray-900">
                                {road.vehicle_count.toLocaleString()}
                              </span>
                            </div>
                            <div className="pt-2 border-t border-gray-200">
                              <span className="text-gray-600 text-xs">Peak Hours:</span>
                              <p className="text-xs font-medium text-gray-900 mt-1">
                                {road.peak_hours.join(', ')}
                              </p>
                            </div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {/* Barangay area circles */}
                {data.by_barangay?.slice(0, 10).map((barangay) => {
                  // Find a representative point for this barangay
                  const barangayRoads = data.top_congested_roads?.filter(
                    r => r.barangay === barangay.barangay
                  );
                  
                  if (!barangayRoads || barangayRoads.length === 0) return null;
                  
                  const firstRoad = barangayRoads[0];
                  const geoPoint = data.geographic_data?.find(
                    g => g.area_name === firstRoad.road_name
                  );
                  
                  if (!geoPoint) return null;
                  
                  const congestion = barangay.avg_congestion;
                  let circleColor = '#22c55e'; // green
                  if (congestion >= 80) circleColor = '#ef4444'; // red
                  else if (congestion >= 60) circleColor = '#f97316'; // orange
                  else if (congestion >= 40) circleColor = '#eab308'; // yellow
                  
                  return (
                    <Circle
                      key={barangay.barangay}
                      center={[geoPoint.latitude, geoPoint.longitude]}
                      radius={500} // 500 meters radius
                      pathOptions={{
                        color: circleColor,
                        fillColor: circleColor,
                        fillOpacity: 0.2,
                        weight: 2
                      }}
                    >
                      <Popup>
                        <div className="p-3 min-w-[200px]">
                          <h3 className="font-bold text-base text-gray-900 mb-2">
                            {barangay.barangay}
                          </h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Avg Congestion:</span>
                              <span className={`font-bold ${getCongestionColor(congestion)}`}>
                                {congestion}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Total Vehicles:</span>
                              <span className="font-medium text-gray-900">
                                {barangay.total_vehicles.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Roads Monitored:</span>
                              <span className="font-medium text-gray-900">
                                {barangay.road_count}
                              </span>
                            </div>
                            <div className="pt-2 border-t border-gray-200">
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(barangay.status)}`}>
                                {barangay.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Popup>
                    </Circle>
                  );
                })}
              </MapContainer>
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No geographic data available</p>
                  <p className="text-sm text-gray-500 mt-1">Traffic data will appear here</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Map Info */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-800">
                <p className="font-medium mb-1">Map Features:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>Numbered markers show top congested roads (click for details)</li>
                  <li>Colored circles represent barangay areas with average congestion</li>
                  <li>Heatmap overlay shows traffic density intensity</li>
                  <li>Zoom in/out and click markers to see detailed statistics</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTrafficReport;

