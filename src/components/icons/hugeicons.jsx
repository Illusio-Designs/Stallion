// Icons for the whole app, from Hugeicons (https://hugeicons.com). The names stay the same as the old
// feather-style set, so a screen only changes its import path. Every icon takes size and className
// like before and follows the text colour.
import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Alert02Icon,
  ArrowLeftDoubleIcon,
  ArrowRight01Icon,
  BarChartIcon,
  Briefcase01Icon,
  Calendar03Icon,
  Cancel01Icon,
  Clock01Icon,
  CreditCardIcon,
  CubeIcon,
  DashboardSquare01Icon,
  DeliveryTruck01Icon,
  Download01Icon,
  Facebook01Icon,
  FavouriteIcon,
  Globe02Icon,
  HelpCircleIcon,
  Home01Icon,
  InboxIcon,
  InstagramIcon,
  Linkedin01Icon,
  Location01Icon,
  MaximizeScreenIcon,
  Menu01Icon,
  MinimizeScreenIcon,
  Navigation03Icon,
  Notification01Icon,
  PackageIcon,
  Search01Icon,
  Settings01Icon,
  Share01Icon,
  ShoppingBag01Icon,
  ShoppingCart01Icon,
  SidebarLeftIcon,
  SlidersHorizontalIcon,
  Tag01Icon,
  UserGroupIcon,
  UserIcon,
  Wrench01Icon,
} from '@hugeicons/core-free-icons';

const make = (icon, name) => {
  const Icon = ({ size = 24, strokeWidth = 1.8, ...rest }) => (
    <HugeiconsIcon icon={icon} size={size} strokeWidth={strokeWidth} {...rest} />
  );
  Icon.displayName = name;
  return Icon;
};

export const FiBox = make(CubeIcon, 'FiBox');
export const FiTag = make(Tag01Icon, 'FiTag');
export const FiGlobe = make(Globe02Icon, 'FiGlobe');
export const FiTool = make(Wrench01Icon, 'FiTool');
export const FiTruck = make(DeliveryTruck01Icon, 'FiTruck');
export const FiUsers = make(UserGroupIcon, 'FiUsers');
export const FiDownload = make(Download01Icon, 'FiDownload');
export const FiX = make(Cancel01Icon, 'FiX');
export const FiShare = make(Share01Icon, 'FiShare');
export const FiInstagram = make(InstagramIcon, 'FiInstagram');
export const FiFacebook = make(Facebook01Icon, 'FiFacebook');
export const FiLinkedin = make(Linkedin01Icon, 'FiLinkedin');
export const FiHeart = make(FavouriteIcon, 'FiHeart');
export const FiMapPin = make(Location01Icon, 'FiMapPin');
export const FiShoppingBag = make(ShoppingBag01Icon, 'FiShoppingBag');
export const FiBarChart2 = make(BarChartIcon, 'FiBarChart2');
export const FiShoppingCart = make(ShoppingCart01Icon, 'FiShoppingCart');
export const FiChevronRight = make(ArrowRight01Icon, 'FiChevronRight');
export const FiUser = make(UserIcon, 'FiUser');
export const FiAlertTriangle = make(Alert02Icon, 'FiAlertTriangle');
export const FiClock = make(Clock01Icon, 'FiClock');
export const FiPackage = make(PackageIcon, 'FiPackage');
export const FiInbox = make(InboxIcon, 'FiInbox');
export const FiNavigation2 = make(Navigation03Icon, 'FiNavigation2');
export const FiMaximize = make(MaximizeScreenIcon, 'FiMaximize');
export const FiMinimize = make(MinimizeScreenIcon, 'FiMinimize');
export const FiBell = make(Notification01Icon, 'FiBell');
export const FiMenu = make(Menu01Icon, 'FiMenu');
export const FiSearch = make(Search01Icon, 'FiSearch');
export const FiSidebar = make(SidebarLeftIcon, 'FiSidebar');
export const FiCreditCard = make(CreditCardIcon, 'FiCreditCard');
export const FiGrid = make(DashboardSquare01Icon, 'FiGrid');
export const FiSliders = make(SlidersHorizontalIcon, 'FiSliders');
export const FiSettings = make(Settings01Icon, 'FiSettings');
export const FiHelpCircle = make(HelpCircleIcon, 'FiHelpCircle');
export const FiCalendar = make(Calendar03Icon, 'FiCalendar');
export const FiBriefcase = make(Briefcase01Icon, 'FiBriefcase');
export const FiChevronsLeft = make(ArrowLeftDoubleIcon, 'FiChevronsLeft');
export const FiHome = make(Home01Icon, 'FiHome');
