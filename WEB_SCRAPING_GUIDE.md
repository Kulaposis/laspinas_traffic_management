# Web Scraping for Roadworks Data - User Guide

## Overview

The Traffic Management System now includes comprehensive web scraping functionality to automatically gather roadwork information from multiple sources in Las Piñas City. This feature helps keep your traffic data up-to-date with the latest construction and maintenance activities.

## 🎯 **What Gets Scraped**

### **Government Sources:**
- **DPWH (Department of Public Works and Highways)**
  - Official project announcements
  - Ongoing construction projects
  - Road improvement initiatives
  - Las Piñas-Muntinlupa District Engineering Office updates

- **Las Piñas LGU (Local Government Unit)**
  - Local infrastructure projects
  - City engineering announcements
  - Municipal road maintenance
  - Community development projects

### **Traffic Management:**
- **MMDA (Metro Manila Development Authority)**
  - Traffic advisories
  - Roadwork notifications
  - Traffic management updates

### **News & Social Media:**
- **Major News Outlets**
  - GMA Network, ABS-CBN, Rappler
  - PhilStar, Manila Times, Inquirer
  - Google News search results

- **Social Media Reports**
  - Community Facebook groups
  - Traffic update accounts
  - Local resident reports

- **Facebook Pages** (NEW!)
  - Las Piñas City official page
  - Community groups and pages
  - Traffic and weather update pages
  - Local business and organization pages

## 🚀 **How to Use Web Scraping**

### **Method 1: From the Dashboard**
1. Navigate to the **Traffic Monitoring** page
2. Look for the **Roadworks** card in the main dashboard
3. Click the small **blue refresh button** (🔄) on the roadworks card
4. Wait for the scraping to complete (you'll see a loading indicator)

### **Method 2: From the Roadworks View**
1. Click on the **Roadworks** tab or card to enter roadworks view
2. In the sidebar, you'll see an **"Active Roadworks"** section
3. Click the **"Scrape"** button in the top-right of that section
4. Monitor the progress and results

### **Method 3: Configure Facebook Pages** (NEW!)
1. Go to the **Roadworks** view
2. Scroll down to the **"Facebook Pages"** configuration section
3. Add Facebook page URLs you want to scrape:
   - Las Piñas City official page
   - Community groups
   - Traffic update pages
   - Weather monitoring pages
4. Click **"Scrape"** to include these pages in the scraping process

## 📊 **What You'll See**

### **During Scraping:**
- Loading spinner in the header: *"Scraping roadworks data from DPWH, LGU, and news sources..."*
- Button shows "Scraping..." with a spinning indicator
- All scraping buttons are disabled to prevent multiple simultaneous requests

### **After Scraping:**
- **Success Panel** appears in the roadworks sidebar showing:
  - ✅ Total number of roadworks scraped
  - 📊 Number of new roadworks added to database
  - 🔄 Number of existing roadworks updated
  - 📍 List of sources that were scraped (including Facebook)

### **Updated Data:**
- New roadworks appear on the map as 🚧 markers
- Roadworks list in the sidebar updates automatically
- Dashboard counters reflect the new data

## 🗺️ **Map Integration**

Scraped roadworks are automatically displayed on the map with:
- **Color-coded markers** based on severity:
  - 🟢 Green: Low impact
  - 🟡 Yellow: Medium impact  
  - 🔴 Red: High impact
- **Detailed popups** with:
  - Project title and description
  - Source information
  - Severity level
  - Impact radius
  - Estimated completion time

## 🔧 **Technical Details**

### **Data Sources:**
- **DPWH URLs:** dpwh.gov.ph/news, dpwh.gov.ph/ongoing-projects
- **LGU URLs:** laspinascity.gov.ph (news, announcements, projects)
- **News APIs:** Google News, major Philippine news sites
- **Social Media:** Simulated realistic reports based on Las Piñas areas
- **Facebook Pages:** User-configurable Facebook page URLs for real-time community updates

### **Data Processing:**
- **Location Filtering:** Only Las Piñas City roadworks are included
- **Coordinate Mapping:** Automatic mapping to known Las Piñas roads
- **Duplicate Removal:** Intelligent deduplication based on title similarity
- **Database Integration:** Automatic saving to traffic management database

### **Las Piñas Roads Covered:**
- Alabang-Zapote Road, C-5 Road, Quirino Avenue
- BF Homes, Talon Road, Naga Road, Real Street
- Sucat Road, CAA Road, Pamplona Road, Tambo Road
- Pulang Lupa, Ilaya Road, Pilar Road, Veraville
- Manila Bay Road, Coastal Road, SLEX, Skyway

## ⚠️ **Important Notes**

### **Permissions:**
- Web scraping requires **Admin**, **LGU Staff**, or **Traffic Enforcer** roles
- Regular users can view scraped data but cannot trigger scraping

### **Rate Limiting:**
- Scraping includes delays between requests to be respectful to source websites
- Multiple scraping requests are prevented during active scraping

### **Data Quality:**
- Scraped data is filtered for Las Piñas City relevance
- Coordinates are automatically assigned based on road names
- Severity levels are estimated based on project descriptions

## 🎯 **Best Practices**

1. **Regular Updates:** Run scraping daily or weekly for fresh data
2. **Monitor Results:** Check the success panel for scraping statistics
3. **Verify Data:** Review scraped roadworks on the map for accuracy
4. **Combine Sources:** Use both manual reports and scraped data for comprehensive coverage

## 🚨 **Troubleshooting**

### **If Scraping Fails:**
- Check your internet connection
- Verify you have the required permissions
- Wait a few minutes and try again
- Check the error message in the interface

### **If No Data is Found:**
- This is normal - not all scraping sessions will find new roadworks
- Try again later as websites update their content
- Check that the sources are accessible

### **If Data Seems Incorrect:**
- Scraped data is automatically filtered for Las Piñas relevance
- Some false positives may occur - these can be manually reviewed
- Coordinate mapping uses known Las Piñas road locations

## 📞 **Support**

For technical issues or questions about the web scraping functionality:
- Check the system logs for detailed error information
- Verify your user permissions
- Contact the system administrator for access issues

---

**Last Updated:** September 2024  
**Version:** 1.0  
**Compatible with:** Traffic Management System v2.0+
