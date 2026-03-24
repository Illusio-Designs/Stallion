import React, { useState, useEffect, useRef } from "react";
import "../styles/pages/Cart.css";
import {
  getCartItems,
  removeFromCart,
  updateCartQuantity,
  registerCartListener,
} from "../services/cartService";
import {
  showRemoveFromCartSuccess,
  showPlaceOrderSuccess,
  showCartUpdateSuccess,
  showError,
  showSuccess,
} from "../services/notificationService";
import { getUserRole, getUser } from "../services/authService";
import {
  getParties,
  getPartyById,
  getEvents,
  getCountries,
  getDistributors,
  createOrder,
  getPartiesByZoneId,
} from "../services/apiService";

const Cart = ({ onPageChange = null }) => {
  const handlePageChange = (page) => {
    if (onPageChange) {
      onPageChange(page);
    } else {
      window.location.href = `/${page}`;
    }
  };
  const [cartItems, setCartItems] = useState([]);
  const [editingQuantities, setEditingQuantities] = useState({});
  
  // Get user role and user info
  const userRole = getUserRole();
  const user = getUser();
  const isParty = userRole === 'party';
  const isDistributor = userRole === 'distributor';
  const isSalesman = userRole === 'salesman';
  
  // Role-based state
  const [orderType, setOrderType] = useState(isDistributor ? "distributor_order" : "");
  const [selectedParty, setSelectedParty] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  
  // Location state for visit orders
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [locationError, setLocationError] = useState(null);
  
  // Dropdown data
  const [countries, setCountries] = useState([]);
  const [parties, setParties] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Ref to track last fetched order type to prevent duplicate API calls
  const lastFetchedOrderType = useRef(null);

  useEffect(() => {
    // Initialize cart items
    const items = getCartItems();
    setCartItems([...items]);

    // Listen for cart changes
    const unsubscribe = registerCartListener(() => {
      const updatedItems = getCartItems();
      setCartItems([...updatedItems]);
    });

    // For distributors, fetch parties by zone_id directly on mount
    if (isDistributor && user) {
      fetchPartiesByZone();
    }
    // For salesmen, parties are fetched based on order type (handled in useEffect below)
    // Note: For party orders, countries and parties are handled differently
    // (countries may be fetched when needed, not on mount)

    return unsubscribe;
  }, []);

  // Helper function to get distributor details (distributor_id and zone_id)
  // Returns: { distributor_id: string, zone_id: string } or null
  // Gets distributor_id and zone_id directly from user object
  const getDistributorDetails = () => {
    if (!user) {
      return null;
    }
    
    try {
      // Get distributor_id from user object (NOT user.id - that's user_id!)
      // Try to get actual distributor_id from user object fields
      const distributorId = user?.distributor_id || 
                           user?.distributorId || 
                           user?.distributor?.distributor_id || 
                           user?.distributor?.id ||
                           null;
      
      // Get zone_id from user object
      const zoneId = user?.zone_id || 
                    user?.zoneId || 
                    user?.distributor?.zone_id || 
                    user?.distributor?.zoneId ||
                    user?.zone_preference ||
                    null;
      
      if (!distributorId) {
        console.warn('[Cart] Distributor ID not found in user object. Available fields:', Object.keys(user || {}));
        console.warn('[Cart] User object:', user);
        return null;
      }
      
      if (!zoneId) {
        console.warn('[Cart] Zone ID not found in user object. Available fields:', Object.keys(user || {}));
        console.warn('[Cart] User object:', user);
        return null;
      }
      
      console.log('[Cart] Found distributor details from user object:', { distributor_id: distributorId, zone_id: zoneId });
      return {
        distributor_id: distributorId,
        zone_id: zoneId
      };
    } catch (err) {
      console.error('[Cart] Failed to get distributor details:', err);
      return null;
    }
  };

  // Fetch parties by zone_id for distributors
  const fetchPartiesByZone = async () => {
    if (!user) {
      setParties([]);
      return;
    }
    
    try {
      console.log('[Cart] Fetching parties by zone (from token)');
      
      // Fetch parties using authorization token (zone_id extracted from token)
      const partiesData = await getPartiesByZoneId();
      setParties(Array.isArray(partiesData) ? partiesData : []);
      console.log('[Cart] Fetched parties by zone:', partiesData.length, 'parties');
    } catch (err) {
      console.error('[Cart] Failed to fetch parties by zone:', err);
      setParties([]);
    }
  };

  // Note: fetchCountries removed - countries are fetched on-demand when needed for party orders only

  // Get user's current location for visit orders (returns Promise)
  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const errorMsg = 'Geolocation is not supported by your browser';
        setLocationError(errorMsg);
        console.error('[Cart] Geolocation not supported');
        reject(new Error(errorMsg));
        return;
      }

      setLocationError(null);
      console.log('[Cart] Requesting user location...');

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = parseFloat(position.coords.latitude);
          const lng = parseFloat(position.coords.longitude);
          setLatitude(lat);
          setLongitude(lng);
          console.log('[Cart] ✅ Location captured - Latitude:', lat, 'Longitude:', lng);
          resolve({ latitude: lat, longitude: lng });
        },
        (error) => {
          console.error('[Cart] Error getting location:', error);
          const errorMsg = error.message || 'Failed to get location';
          setLocationError(errorMsg);
          setLatitude(null);
          setLongitude(null);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    });
  };

  // Fetch parties based on order type for salesman
  useEffect(() => {
    if (!isSalesman || !user) {
      return;
    }

    if (!orderType) {
      // Reset parties and location when order type is cleared
      setParties([]);
      setSelectedParty("");
      setLatitude(null);
      setLongitude(null);
      setLocationError(null);
      lastFetchedOrderType.current = null;
      return;
    }

    // Prevent duplicate API calls - only fetch if order type actually changed
    if (lastFetchedOrderType.current === orderType) {
      return;
    }

    // Reset parties, location, and events when order type changes
    setParties([]);
    setSelectedParty("");
    setLatitude(null);
    setLongitude(null);
    setLocationError(null);
    // Clear events if not event_order
    if (orderType !== 'event_order') {
      setEvents([]);
      setSelectedEvent("");
    }
    lastFetchedOrderType.current = orderType;

    const fetchPartiesForOrderType = async () => {
      try {
        if (orderType === 'visit_order' || orderType === 'whatsapp_order') {
          // For visit_order and whatsapp_order: use getPartiesByZoneId (token only)
          console.log('[Cart] Fetching parties by zone for', orderType);
          const partiesData = await getPartiesByZoneId();
      setParties(Array.isArray(partiesData) ? partiesData : []);
          console.log('[Cart] Fetched parties by zone:', partiesData.length, 'parties');
          
          // Capture location for visit_order
          if (orderType === 'visit_order') {
            getCurrentLocation();
          }
        } else if (orderType === 'event_order') {
          // For event_order: use getParties() without countryId (gets all parties)
          console.log('[Cart] Fetching all parties for event_order');
          const partiesData = await getParties(); // No countryId = gets all parties
          setParties(Array.isArray(partiesData) ? partiesData : []);
          console.log('[Cart] Fetched all parties:', partiesData.length, 'parties');
        }
    } catch (err) {
        console.error('[Cart] Failed to fetch parties for order type:', err);
      setParties([]);
        // Reset ref on error so it can retry
        lastFetchedOrderType.current = null;
    }
  };

    fetchPartiesForOrderType();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderType, isSalesman]); // Only depend on orderType and isSalesman, not user object

  // Fetch events when event_order is selected (for salesman)
  useEffect(() => {
    if (isSalesman && orderType === 'event_order') {
      fetchEvents();
    } else {
      setEvents([]);
    }
  }, [orderType, isSalesman]);

  const fetchEvents = async () => {
    try {
      const eventsData = await getEvents();
      setEvents(Array.isArray(eventsData) ? eventsData : []);
    } catch (err) {
      console.error('Failed to fetch events:', err);
      setEvents([]);
    }
  };

  const handleRemoveItem = (productId) => {
    const item = cartItems.find((item) => item.id === productId);
    const itemName = item ? `${item.name} (${item.lenseColour})` : "Item";
    removeFromCart(productId);
    showRemoveFromCartSuccess(itemName);
  };

  const handleQuantityIncrease = (productId) => {
    const currentItems = getCartItems();
    const item = currentItems.find((item) => item.id === productId);
    if (item) {
      const newQuantity = item.quantity + 1;
      updateCartQuantity(productId, newQuantity);
      const itemName = `${item.name} (${item.lenseColour})`;
      showCartUpdateSuccess(itemName, newQuantity);
    }
  };

  const handleQuantityDecrease = (productId) => {
    const currentItems = getCartItems();
    const item = currentItems.find((item) => item.id === productId);
    if (item && item.quantity > 1) {
      const newQuantity = item.quantity - 1;
      updateCartQuantity(productId, newQuantity);
      const itemName = `${item.name} (${item.lenseColour})`;
      showCartUpdateSuccess(itemName, newQuantity);
    }
  };

  const handleQuantityInputChange = (productId, value) => {
    const currentItems = getCartItems();
    const item = currentItems.find((item) => item.id === productId);
    if (!item) return;

    const parsed = parseInt(value, 10);
    const newQuantity = Number.isNaN(parsed) ? 1 : Math.max(1, parsed);
    updateCartQuantity(productId, newQuantity);
    const itemName = `${item.name} (${item.lenseColour})`;
    showCartUpdateSuccess(itemName, newQuantity);
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => {
      // Extract numeric value from whp (e.g., "₹2,090" -> 2090)
      const price = parseFloat(String(item.whp || item.mrp || 0).replace(/[₹,]/g, "")) || 0;
      return total + price * item.quantity;
    }, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal();
  };

  const formatPrice = (amount) => {
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  const getDisplayName = (item) => {
    return `${item.name} - ${item.lenseColour}`;
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      showError('Your cart is empty');
      return;
    }

    // Validation based on role
    if (isDistributor) {
      // Party selection is REQUIRED for distributor orders
      if (!selectedParty) {
        showError('Please select a party');
        return;
      }
    }

    if (isSalesman) {
      if (!orderType) {
        showError('Please select an order type');
        return;
      }
      if (orderType === 'event_order' && !selectedEvent) {
        showError('Please select an event');
        return;
      }
      if (orderType === 'visit_order' && (latitude === null || longitude === null)) {
        // Try to get location and wait for it before proceeding
        setLoading(true);
        try {
          showError('Please allow location access for visit orders. Capturing location...');
          await getCurrentLocation();
          console.log('[Cart] ✅ Location captured successfully, proceeding with checkout');
          setLoading(false);
          // Continue with checkout - location is now set
        } catch (err) {
          console.error('[Cart] ❌ Failed to capture location:', err);
          setLoading(false);
          showError('Failed to get location. Please enable location access in your browser settings and try again.');
          return;
        }
      }
      if (!selectedParty) {
        showError('Please select a party');
        return;
      }
    }

    setLoading(true);
    try {
      // Prepare order items
      const orderItems = cartItems.map(item => {
        const quantity = editingQuantities[item.id] !== undefined 
          ? parseInt(editingQuantities[item.id], 10) || item.quantity 
          : item.quantity;
        const price = parseFloat(String(item.whp || item.mrp || 0).replace(/[₹,]/g, "")) || 0;
        
        return {
          product_id: item.id,
          quantity: quantity,
          price: price
        };
      });

      // Prepare order data
      const orderData = {
        order_date: new Date().toISOString(),
        order_items: orderItems,
      };

      // Set order type
      if (isParty) {
        orderData.order_type = 'party_order';
      } else if (isDistributor) {
        orderData.order_type = 'distributor_order';
      } else if (isSalesman && orderType) {
        orderData.order_type = orderType;
        // Set event_id for event_order type (required - validated above)
        if (orderType === 'event_order' && selectedEvent) {
          orderData.event_id = selectedEvent;
          console.log('[Cart] ✅ Event ID set for event_order:', selectedEvent);
        }
      }

      // ============================================
      // DISTRIBUTOR ORDERS
      // Backend requirements:
      // - distributor_id: Extracted from authorization token (NOT sent in body)
      // - zone_id: Extracted from authorization token (NOT sent in body)
      // - party_id: REQUIRED (party must be selected)
      // - salesman_id: NOT included (backend excludes it)
      // ============================================
      if (isDistributor) {
        // Set party_id (required - validated above)
        if (selectedParty) {
          orderData.party_id = selectedParty;
          console.log('[Cart] Distributor order - party_id:', selectedParty);
        }
        
        // Note: distributor_id and zone_id are NOT set - backend extracts from authorization token
        // Note: salesman_id is NOT set for distributor orders (backend excludes it)
      } else if (isParty) {
        // ============================================
        // PARTY ORDERS
        // ============================================
        
        // Debug: Log user object to see what fields are available
        console.log('[Cart] Party user object:', user);
        console.log('[Cart] Available user fields:', Object.keys(user || {}));
        console.log('[Cart] user.party_id:', user?.party_id);
        console.log('[Cart] user.partyId:', user?.partyId);
        console.log('[Cart] user.party:', user?.party);
        console.log('[Cart] user.id:', user?.id);
      }
      
      // Debug: Log distributor user object
      if (isDistributor) {
        console.log('[Cart] Distributor user object:', user);
        console.log('[Cart] Available user fields:', Object.keys(user || {}));
        console.log('[Cart] user.distributor_id:', user?.distributor_id);
        console.log('[Cart] user.distributorId:', user?.distributorId);
        console.log('[Cart] user.distributor:', user?.distributor);
        console.log('[Cart] user.id:', user?.id);
        console.log('[Cart] user.zone_id:', user?.zone_id);
        console.log('[Cart] user.zone_preference:', user?.zone_preference);
        console.log('[Cart] user.distributor?.zone_id:', user?.distributor?.zone_id);
      }

      // Set party_id, distributor_id, and zone_id for party users
      if (isParty) {
        // Search for party by user's phone number (since party has phone field)
        let partyId = null;
        let distributorId = null;
        let zoneId = null;
        
        if (user?.phone) {
          console.log('[Cart] Searching for party by phone:', user.phone);
          try {
            // Fetch countries first
            let countriesList = countries;
            if (!countriesList || countriesList.length === 0) {
              countriesList = await getCountries();
              setCountries(countriesList);
            }
            
            // Normalize phone for comparison
            const normalizePhone = (phone) => {
              if (!phone) return '';
              return String(phone).trim().replace(/^\+/, '').replace(/[\s-]/g, '');
            };
            
            const userPhone = normalizePhone(user.phone);
            
            // Collect ALL parties from ALL countries (before filtering)
            // The backend returns parties even for wrong countries, so we collect them all
            const allPartiesMap = new Map(); // Use Map to avoid duplicates by party_id
            
            // Helper function to make API call directly
            const fetchPartiesRaw = async (countryId) => {
              const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stallion.nishree.com/api';
              const url = baseUrl.endsWith('/api') ? `${baseUrl}/parties/get` : `${baseUrl}/api/parties/get`;
              const token = localStorage.getItem('token');
              
              const response = await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: JSON.stringify({ country_id: countryId })
              });
              
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
              }
              
              return await response.json();
            };
            
            for (const country of countriesList) {
              try {
                const countryId = country.id || country.country_id;
                if (!countryId) continue;
                
                // Make direct API call to get raw response (before getParties filters it)
                const response = await fetchPartiesRaw(countryId);
                
                // Collect all parties from raw response (before filtering)
                let partiesArray = [];
                if (Array.isArray(response)) {
                  partiesArray = response;
                } else if (response && Array.isArray(response.data)) {
                  partiesArray = response.data;
                }
                
                // Add all parties to map (keyed by party_id to avoid duplicates)
                partiesArray.forEach(p => {
                  if (p) {
                    const pId = p.id || p.party_id;
                    if (pId && !allPartiesMap.has(pId)) {
                      allPartiesMap.set(pId, p);
                    }
                  }
                });
              } catch (err) {
                console.warn(`[Cart] Failed to fetch parties for country ${country.id}:`, err);
              }
            }
            
            // Now search through all collected parties (without country filtering)
            const allParties = Array.from(allPartiesMap.values());
            console.log(`[Cart] Collected ${allParties.length} unique parties from all countries`);
            
            const partyData = allParties.find(p => {
              const partyPhone = normalizePhone(p.phone || p.phoneNumber);
              return partyPhone && partyPhone === userPhone;
            });
            
            if (partyData) {
              partyId = partyData.id || partyData.party_id || null;
              // Get distributor_id from party data first
              let partyDistributorId = partyData?.distributor_id || 
                             partyData?.distributorId || 
                             partyData?.distributor?.distributor_id || 
                             partyData?.distributor?.id ||
                             null;
              // Get zone_id from party data
              zoneId = partyData?.zone_id || partyData?.zoneId || null;
              
              if (partyId) {
                console.log('[Cart] Found party by phone:', partyId);
                console.log('[Cart] Found distributor_id from party:', partyDistributorId);
                console.log('[Cart] Found zone_id from party:', zoneId);
                
                // If distributor_id is not in party data, try to get full party details
                if (!partyDistributorId || !zoneId) {
                  try {
                    console.log('[Cart] Distributor ID or zone_id not found in party data, fetching full party details...');
                    const fullPartyData = await getPartyById(partyId);
                    if (fullPartyData) {
                      if (!partyDistributorId) {
                        partyDistributorId = fullPartyData?.distributor_id || 
                                           fullPartyData?.distributorId || 
                                           fullPartyData?.distributor?.distributor_id || 
                                           fullPartyData?.distributor?.id ||
                                           null;
                        console.log('[Cart] Found distributor_id from full party data:', partyDistributorId);
                      }
                      if (!zoneId) {
                        zoneId = fullPartyData?.zone_id || fullPartyData?.zoneId || null;
                        console.log('[Cart] Found zone_id from full party data:', zoneId);
                      }
                    }
                  } catch (err) {
                    console.warn('[Cart] Failed to fetch full party data:', err);
                  }
                }
              }
              
              // Always fetch all distributors to get distributor_id
              try {
                console.log('[Cart] Fetching all distributors...');
                const allDistributorsMap = new Map(); // Use Map to avoid duplicates
                
                // Get party's country_id to prioritize fetching distributors for that country
                const partyCountryId = partyData?.country_id || null;
                
                // Fetch distributors for all countries
                for (const country of countriesList) {
                  try {
                    const countryId = country.id || country.country_id;
                    if (!countryId) continue;
                    
                    const distributorsData = await getDistributors(countryId);
                    
                    // Add all distributors to map (keyed by distributor_id to avoid duplicates)
                    if (Array.isArray(distributorsData)) {
                      distributorsData.forEach(d => {
                        if (d) {
                          const dId = d.distributor_id || d.id;
                          if (dId && !allDistributorsMap.has(dId)) {
                            allDistributorsMap.set(dId, d);
                          }
                        }
                      });
                    }
                  } catch (err) {
                    console.warn(`[Cart] Failed to fetch distributors for country ${country.id}:`, err);
                  }
                }
                
                const allDistributors = Array.from(allDistributorsMap.values());
                console.log(`[Cart] Collected ${allDistributors.length} unique distributors from all countries`);
                
                // Find distributor by ID from party data
                if (partyDistributorId) {
                  const distributorData = allDistributors.find(d => {
                    const dId = d.distributor_id || d.id;
                    return dId && String(dId) === String(partyDistributorId);
                  });
                  
                  if (distributorData) {
                    distributorId = distributorData.distributor_id || distributorData.id || null;
                    console.log('[Cart] Found distributor_id from all distributors:', distributorId);
                  } else {
                    // If not found, use the one from party data
                    distributorId = partyDistributorId;
                    console.log('[Cart] Distributor not found in all distributors list, using party distributor_id:', distributorId);
                  }
                } else {
                  // If no distributor_id from party, find distributor by party's country
                  if (partyCountryId) {
                    // Filter distributors by party's country
                    const distributorsInPartyCountry = allDistributors.filter(d => {
                      const dCountryId = d.country_id || d.countryId;
                      return dCountryId && String(dCountryId) === String(partyCountryId);
                    });
                    
                    console.log(`[Cart] Found ${distributorsInPartyCountry.length} distributors in party's country`);
                    
                    if (distributorsInPartyCountry.length > 0) {
                      // Use the first distributor from the party's country
                      distributorId = distributorsInPartyCountry[0].distributor_id || distributorsInPartyCountry[0].id || null;
                      console.log('[Cart] Using distributor from party country:', distributorId);
                    } else {
                      console.warn('[Cart] No distributor found in party country, trying all distributors...');
                      // Fallback: use first distributor from all countries if none found in party country
                      if (allDistributors.length > 0) {
                        distributorId = allDistributors[0].distributor_id || allDistributors[0].id || null;
                        console.log('[Cart] Using first available distributor as fallback:', distributorId);
                      } else {
                        console.error('[Cart] No distributors found at all');
                      }
                    }
                  } else {
                    // If party has no country_id, use first available distributor
                    if (allDistributors.length > 0) {
                      distributorId = allDistributors[0].distributor_id || allDistributors[0].id || null;
                      console.log('[Cart] Party has no country_id, using first available distributor:', distributorId);
                    } else {
                      console.error('[Cart] No distributors found and party has no country_id');
                    }
                  }
                }
              } catch (err) {
                console.error('[Cart] Failed to fetch all distributors:', err);
                // Fallback to distributor_id from party data if available
                if (partyDistributorId) {
                  distributorId = partyDistributorId;
                }
              }
            }
          } catch (err) {
            console.error('[Cart] Failed to search for party:', err);
          }
        }
        
        if (!partyId) {
          console.error('[Cart] Party not found by phone number. User phone:', user?.phone);
          showError('Party not found. Please contact support.');
          setLoading(false);
          return;
        }
        
        orderData.party_id = partyId;
        
        if (distributorId) {
          orderData.distributor_id = distributorId;
          console.log('[Cart] Using Party ID:', partyId, 'Distributor ID:', distributorId);
        } else {
          console.error('[Cart] Distributor ID not found for party:', partyId);
          showError('Distributor ID is required for party orders. Please contact support.');
          setLoading(false);
          return;
        }
        
        // Add zone_id for party orders (required by backend)
        if (zoneId) {
          orderData.zone_id = zoneId;
          console.log('[Cart] Using Zone ID:', zoneId);
        } else {
          console.warn('[Cart] Zone ID not found for party:', partyId);
          // Zone ID might not be critical, but log warning
        }
      } else if (selectedParty) {
        orderData.party_id = selectedParty;
        
        // For salesman orders, fetch party data to get distributor_id
        // For distributor orders, distributor_id comes from logged-in user (handled below)
        if (isSalesman) {
          try {
            const partyData = await getPartyById(selectedParty);
            
            if (partyData) {
              // Get zone_id from party data for visit_order, whatsapp_order, and event_order
              if (orderData.order_type === 'visit_order' || orderData.order_type === 'whatsapp_order' || orderData.order_type === 'event_order') {
                const partyZoneId = partyData?.zone_id || 
                                   partyData?.zoneId || 
                                   partyData?.distributor?.zone_id ||
                                   null;
                if (partyZoneId && !orderData.zone_id) {
                  orderData.zone_id = partyZoneId;
                  console.log('[Cart] ✅ Zone ID set for', orderData.order_type, 'from party data:', partyZoneId);
                }
              }
              
              // Get distributor_id from party data first
              const partyDistributorId = partyData?.distributor_id || 
                                   partyData?.distributorId || 
                                   partyData?.distributor?.distributor_id || 
                                   partyData?.distributor?.id ||
                                   null;
              
              // Fetch all distributors to get distributor_id
              if (partyDistributorId) {
                try {
                  console.log('[Cart] Fetching all distributors for selected party...');
                  // Fetch countries if not already available
                  let countriesList = countries;
                  if (!countriesList || countriesList.length === 0) {
                    countriesList = await getCountries();
                    setCountries(countriesList);
                  }
                  
                  const allDistributorsMap = new Map(); // Use Map to avoid duplicates
                  
                  // Fetch distributors for all countries
                  for (const country of countriesList) {
                    try {
                      const countryId = country.id || country.country_id;
                      if (!countryId) continue;
                      
                      const distributorsData = await getDistributors(countryId);
                      
                      // Add all distributors to map (keyed by distributor_id to avoid duplicates)
                      if (Array.isArray(distributorsData)) {
                        distributorsData.forEach(d => {
                          if (d) {
                            const dId = d.distributor_id || d.id;
                            if (dId && !allDistributorsMap.has(dId)) {
                              allDistributorsMap.set(dId, d);
                            }
                          }
                        });
                      }
                    } catch (err) {
                      console.warn(`[Cart] Failed to fetch distributors for country ${country.id}:`, err);
                    }
                  }
                  
                  const allDistributors = Array.from(allDistributorsMap.values());
                  console.log(`[Cart] Collected ${allDistributors.length} unique distributors from all countries`);
                  
                  // Find distributor by ID from party data
                  const distributorData = allDistributors.find(d => {
                    const dId = d.distributor_id || d.id;
                    return dId && String(dId) === String(partyDistributorId);
                  });
                  
                  if (distributorData) {
                    const distributorId = distributorData.distributor_id || distributorData.id || null;
                    orderData.distributor_id = distributorId;
                    console.log('[Cart] Found distributor_id from all distributors:', distributorId);
                  } else {
                    // If not found, use the one from party data
                    orderData.distributor_id = partyDistributorId;
                    console.log('[Cart] Distributor not found in all distributors list, using party distributor_id:', partyDistributorId);
                  }
                } catch (err) {
                  console.warn('[Cart] Failed to fetch all distributors:', err);
                  // Fallback to distributor_id from party data
                  if (partyDistributorId) {
                    orderData.distributor_id = partyDistributorId;
                    console.log('[Cart] Using distributor_id from party data:', partyDistributorId);
                  }
                }
              }
            }
          } catch (err) {
            console.warn('[Cart] Failed to fetch party data for distributor_id:', err);
            // Continue without distributor_id - not critical
          }
        }
      } else if (isSalesman) {
        // ============================================
        // SALESMAN ORDERS
        // ============================================
        
        // Set party_id if selected (required for salesman orders)
        if (selectedParty) {
          orderData.party_id = selectedParty;
        }
        
        // Set salesman_id (required for salesman orders)
        // Try multiple ways to get salesman_id from user object
        // For salesman users, user.id is typically the salesman_id
        let salesmanId = user?.salesman_id || 
                        user?.salesmanId || 
                        user?.salesman?.salesman_id ||
                        user?.salesman?.id ||
                        null;
        
        // If not found in specific fields, use user.id for salesman users
        // This is the most common case - for salesman users, their user.id IS their salesman_id
        if (!salesmanId && isSalesman) {
          if (user?.id) {
            salesmanId = user.id;
            console.log('[Cart] Using user.id as salesman_id (common case for salesman users):', salesmanId);
          } else {
            // Try to extract from JWT token as last resort
            try {
              const token = localStorage.getItem('token');
              if (token) {
                const tokenParts = token.split('.');
                if (tokenParts.length === 3) {
                  const payload = JSON.parse(atob(tokenParts[1]));
                  const tokenSalesmanId = payload.salesman_id || payload.salesmanId || payload.userId || payload.user_id;
                  if (tokenSalesmanId) {
                    salesmanId = tokenSalesmanId;
                    console.log('[Cart] Extracted salesman_id from JWT token:', salesmanId);
                  }
                }
              }
            } catch (err) {
              console.warn('[Cart] Failed to extract salesman_id from token:', err);
            }
          }
        }
        
        // Always set salesman_id if we found it, or use user.id as absolute fallback
        if (salesmanId) {
          orderData.salesman_id = salesmanId;
          console.log('[Cart] ✅ Salesman ID set:', salesmanId);
        } else if (user?.id) {
          // Last resort: use user.id (backend will validate if this is correct)
          orderData.salesman_id = user.id;
          console.log('[Cart] ⚠️ Using user.id as salesman_id (last resort):', user.id);
        } else {
          console.error('[Cart] ❌ CRITICAL: Cannot determine salesman_id');
          console.error('[Cart] User object keys:', Object.keys(user || {}));
          console.error('[Cart] User object:', JSON.stringify(user, null, 2));
          console.error('[Cart] isSalesman:', isSalesman);
        }
        
        // Set zone_id for visit_order, whatsapp_order, and event_order
        if (orderType === 'visit_order' || orderType === 'whatsapp_order' || orderType === 'event_order' ||
            orderData.order_type === 'visit_order' || orderData.order_type === 'whatsapp_order' || orderData.order_type === 'event_order') {
          // Try to get zone_id from user object first
          const zoneId = user?.zone_id || 
                        user?.zoneId || 
                        user?.zone_preference ||
                        null;
          
          if (zoneId) {
            orderData.zone_id = zoneId;
            console.log('[Cart] ✅ Zone ID set for', orderData.order_type, 'from user:', zoneId);
          } else {
            console.warn('[Cart] ⚠️ Zone ID not found in user object for', orderData.order_type);
            // Will try to get from party data below if available
          }
        }
        
        // Event_id is already set above when order_type is set, but verify it's set here as well
        if (orderData.order_type === 'event_order') {
          if (!orderData.event_id && selectedEvent) {
          orderData.event_id = selectedEvent;
            console.log('[Cart] ✅ Event ID set for event_order (fallback):', selectedEvent);
          }
          if (!orderData.event_id) {
            console.error('[Cart] ❌ Event order but event_id is missing!');
            console.error('[Cart] selectedEvent:', selectedEvent);
            showError('Event ID is required for event orders');
            setLoading(false);
            return;
          }
        }
        
        // Set latitude and longitude for visit_order type
        if (orderType === 'visit_order' || orderData.order_type === 'visit_order') {
          console.log('[Cart] Setting location for visit_order - latitude:', latitude, 'longitude:', longitude);
          console.log('[Cart] orderType:', orderType, 'orderData.order_type:', orderData.order_type);
          // Convert to numbers and ensure they're set
          if (latitude !== null && latitude !== undefined) {
            orderData.latitude = parseFloat(latitude);
          } else {
            orderData.latitude = latitude;
          }
          if (longitude !== null && longitude !== undefined) {
            orderData.longitude = parseFloat(longitude);
          } else {
            orderData.longitude = longitude;
          }
          console.log('[Cart] ✅ Visit order - location set in orderData:', {
            latitude: orderData.latitude,
            longitude: orderData.longitude,
            type: { lat: typeof orderData.latitude, lng: typeof orderData.longitude }
          });
        }
      }

      // Format order_date to match backend format (YYYY-MM-DDTHH:mm:ss)
      const orderDate = new Date(orderData.order_date);
      const formattedDate = orderDate.toISOString().split('.')[0]; // Remove milliseconds
      orderData.order_date = formattedDate;

      // Add optional order_notes
      orderData.order_notes = orderData.order_notes || 'Order placed from cart';

      // Safety check: Ensure latitude and longitude are set for visit_order (in case they weren't set earlier)
      if (orderData.order_type === 'visit_order') {
        if (orderData.latitude === undefined || orderData.latitude === null) {
          console.log('[Cart] Safety check: Setting latitude from state for visit_order');
          orderData.latitude = latitude !== null && latitude !== undefined ? parseFloat(latitude) : latitude;
        } else {
          orderData.latitude = parseFloat(orderData.latitude);
        }
        if (orderData.longitude === undefined || orderData.longitude === null) {
          console.log('[Cart] Safety check: Setting longitude from state for visit_order');
          orderData.longitude = longitude !== null && longitude !== undefined ? parseFloat(longitude) : longitude;
        } else {
          orderData.longitude = parseFloat(orderData.longitude);
        }
        console.log('[Cart] Safety check complete - location in orderData:', {
          latitude: orderData.latitude,
          longitude: orderData.longitude
        });
      }

      // Final check: Ensure event_id is set for event_order
      if (orderData.order_type === 'event_order' && !orderData.event_id) {
        console.error('[Cart] ❌ CRITICAL: event_order but event_id is missing!');
        console.error('[Cart] selectedEvent:', selectedEvent);
        console.error('[Cart] orderData:', orderData);
        showError('Event ID is required for event orders');
        setLoading(false);
        return;
      }

      // Final check: Ensure latitude and longitude are set for visit_order
      if (orderData.order_type === 'visit_order') {
        // Use state values if orderData doesn't have them
        if (orderData.latitude === undefined || orderData.latitude === null) {
          orderData.latitude = latitude !== null && latitude !== undefined ? parseFloat(latitude) : latitude;
        } else {
          orderData.latitude = parseFloat(orderData.latitude);
        }
        if (orderData.longitude === undefined || orderData.longitude === null) {
          orderData.longitude = longitude !== null && longitude !== undefined ? parseFloat(longitude) : longitude;
        } else {
          orderData.longitude = parseFloat(orderData.longitude);
        }
        
        // Now validate that we have valid location data (must be numbers, not null/undefined)
        if (orderData.latitude === null || orderData.longitude === null || 
            orderData.latitude === undefined || orderData.longitude === undefined ||
            isNaN(orderData.latitude) || isNaN(orderData.longitude)) {
          console.error('[Cart] ❌ CRITICAL: visit_order but location is missing or invalid!');
          console.error('[Cart] latitude state:', latitude, 'longitude state:', longitude);
          console.error('[Cart] orderData.latitude:', orderData.latitude, 'orderData.longitude:', orderData.longitude);
          console.error('[Cart] orderData:', JSON.stringify(orderData, null, 2));
          showError('Location is required for visit orders. Please allow location access.');
          setLoading(false);
          return;
        }
        
        // Ensure they are numbers
        orderData.latitude = Number(orderData.latitude);
        orderData.longitude = Number(orderData.longitude);
        
        console.log('[Cart] ✅ Visit order location validated and set:', {
          latitude: orderData.latitude,
          longitude: orderData.longitude,
          types: { lat: typeof orderData.latitude, lng: typeof orderData.longitude }
        });
      }

      // Final check: Log salesman_id status (but don't block API call - let backend validate)
      if (isSalesman) {
        if (!orderData.salesman_id) {
          console.warn('[Cart] ⚠️ WARNING: Salesman order but salesman_id is missing - API will run, backend will validate');
          console.warn('[Cart] User object:', user);
          console.warn('[Cart] orderData:', JSON.stringify(orderData, null, 2));
        } else {
          console.log('[Cart] ✅ Salesman ID validated:', orderData.salesman_id);
        }
      }

      console.log('[Cart] Creating order with data:', orderData);
      console.log('[Cart] Order type:', orderData.order_type);
      console.log('[Cart] Salesman ID:', orderData.salesman_id);
      console.log('[Cart] Event ID:', orderData.event_id);
      console.log('[Cart] Latitude:', orderData.latitude, 'Longitude:', orderData.longitude);
      
      // Final verification for visit_order - log the complete body
      if (orderData.order_type === 'visit_order') {
        console.log('[Cart] 🔍 FINAL CHECK - Visit order body:', JSON.stringify({
          ...orderData,
          latitude: orderData.latitude,
          longitude: orderData.longitude
        }, null, 2));
        if (!orderData.latitude || !orderData.longitude) {
          console.error('[Cart] ❌ ERROR: Latitude or longitude is missing in final check!');
          showError('Location is required for visit orders');
          setLoading(false);
          return;
        }
      }

      // Create order via API
      console.log('[Cart] 🚀 ABOUT TO CALL createOrder API...');
      console.log('[Cart] 📦 Final orderData before API call:', JSON.stringify(orderData, null, 2));
      console.log('[Cart] 📋 Order summary:', {
        order_type: orderData.order_type,
        salesman_id: orderData.salesman_id,
        party_id: orderData.party_id,
        zone_id: orderData.zone_id,
        event_id: orderData.event_id,
        latitude: orderData.latitude,
        longitude: orderData.longitude,
        order_items_count: orderData.order_items?.length || 0
      });
      
      const createdOrder = await createOrder(orderData);
      console.log('[Cart] ✅ Order created successfully:', createdOrder);
      
      showPlaceOrderSuccess();
      
      // Clear cart after successful order
      cartItems.forEach(item => {
        removeFromCart(item.id);
      });
      
      // Reset form
      setSelectedParty("");
      setSelectedEvent("");
      setSelectedCountry("");
      if (isSalesman) {
        setOrderType("");
      }
    } catch (err) {
      const errorMessage = err?.message || err?.errorData?.error || 'Failed to place order';
      showError(errorMessage);
      console.error('Order creation error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Determine if party dropdown should be shown
  const shouldShowPartyDropdown = () => {
    if (isParty) return false; // Party role: no dropdowns
    if (isDistributor) return true; // Distributor: show party dropdown (no country needed)
    if (isSalesman && orderType) return true; // Salesman: show after order type selected
    return false;
  };

  // Determine if event dropdown should be shown
  const shouldShowEventDropdown = () => {
    // Only show for salesman and when event_order is selected
    return isSalesman && orderType === 'event_order';
  };

  // Determine if country dropdown should be shown (needed for party selection)
  // For distributors and salesmen, no country dropdown needed - parties are fetched by zone_id
  // Country dropdown is only needed for party orders (not implemented in this component)
  const shouldShowCountryDropdown = () => {
    return false; // No country dropdown needed - parties fetched by zone_id for distributors and salesmen
  };

  return (
    <div className="cart-page">
      <div className="cart-container">
        <div className="cart-content">
          {/* Shopping Cart Section */}
          <div className="shopping-cart-section">
            <h2 className="section-title">Shopping Cart</h2>

            {cartItems.length === 0 ? (
              <div className="empty-cart">
                <p>Your cart is empty</p>
              </div>
            ) : (
              <div className="cart-items">
                <div className="cart-items-header">
                  <div className="header-item">ITEMS</div>
                  <div className="header-qty">QTY</div>
                  <div className="header-subtotal">SUBTOTAL</div>
                  <div className="header-remove"></div>
                </div>

                {cartItems.map((item) => (
                  <div key={item.id} className="cart-item">
                  <div className="item-info">
                    <div className="item-image">
                      <img 
                        src={item.image || '/images/products/spac1.webp'} 
                        alt={item.name}
                        onError={(e) => {
                          // Fallback to default image if image fails to load
                          if (e.target.src !== '/images/products/spac1.webp') {
                            e.target.src = '/images/products/spac1.webp';
                          }
                        }}
                      />
                    </div>
                    <div className="item-details">
                      <h3 className="item-name">{getDisplayName(item)}</h3>
                    </div>
                  </div>
                    <div className="item-qty">
                      <div className="quantity-selector-cart">
                        <button
                          className="qty-btn-cart minus"
                          onClick={() => handleQuantityDecrease(item.id)}
                          disabled={item.quantity <= 1}
                        >
                          -
                        </button>
                        <input
                          className="qty-number-cart"
                          type="number"
                          step="1"
                          value={editingQuantities[item.id] !== undefined ? editingQuantities[item.id] : item.quantity}
                          onChange={e => {
                            setEditingQuantities(q => ({ ...q, [item.id]: e.target.value }));
                            const itemName = `${item.name} (${item.lenseColour})`;
                            const num = parseInt(e.target.value, 10);
                            showCartUpdateSuccess(itemName, (!e.target.value || isNaN(num) || num < 1) ? 1 : num);
                          }}
                          onBlur={e => {
                            const val = editingQuantities[item.id];
                            const num = parseInt(val, 10);
                            handleQuantityInputChange(item.id, (!val || isNaN(num) || num < 1) ? '1' : val);
                            setEditingQuantities(q => {
                              const { [item.id]: _, ...rest } = q;
                              return rest;
                            });
                          }}
                        />
                        <button
                          className="qty-btn-cart plus"
                          onClick={() => handleQuantityIncrease(item.id)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="item-subtotal">
                      {formatPrice(parseFloat(String(item.whp || item.mrp || 0).replace(/[₹,]/g, '')) * (parseInt(editingQuantities[item.id], 10) > 0 ? parseInt(editingQuantities[item.id], 10) : item.quantity))}
                    </div>
                    <div className="item-remove">
                      <button
                        className="remove-btn"
                        onClick={() => handleRemoveItem(item.id)}
                        title="Remove item"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary Section */}
          <div className="summary-section">
            <h2 className="section-title">Summary</h2>

            <div className="summary-form">
              {/* Order Type Dropdown - Only for Salesman */}
              {isSalesman && (
                <div className="form-group">
                  <label htmlFor="order-type" className="form-label">Order Type</label>
                  <select
                    id="order-type"
                    className="summary-dropdown"
                    value={orderType}
                    onChange={(e) => {
                      const newOrderType = e.target.value;
                      setOrderType(newOrderType);
                      // Reset party and event when order type changes
                      setSelectedParty("");
                      setSelectedEvent("");
                      // Reset country (not needed for salesman, but clean up state)
                      setSelectedCountry("");
                      // Clear events if switching away from event_order
                      if (newOrderType !== 'event_order') {
                        setEvents([]);
                      }
                    }}
                  >
                    <option value="">Select Order Type</option>
                    <option value="visit_order">Visit Order</option>
                    <option value="whatsapp_order">WhatsApp Order</option>
                    <option value="event_order">Event Order</option>
                  </select>
                </div>
              )}

              {/* Country Dropdown - For Distributor and Salesman (when party selection is needed) */}
              {shouldShowCountryDropdown() && (
                <div className="form-group">
                  <label htmlFor="country" className="form-label">Country</label>
                  <select
                    id="country"
                    className="summary-dropdown"
                    value={selectedCountry}
                    onChange={(e) => {
                      setSelectedCountry(e.target.value);
                      // Reset party when country changes
                      setSelectedParty("");
                    }}
                  >
                    <option value="">Select Country</option>
                    {countries.map(country => (
                      <option key={country.id || country.country_id} value={country.id || country.country_id}>
                        {country.country_name || country.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Event Dropdown - Only for Salesman when event_order is selected */}
              {shouldShowEventDropdown() && (
                <div className="form-group">
                  <label htmlFor="event" className="form-label">Event</label>
                  <select
                    id="event"
                    className="summary-dropdown"
                    value={selectedEvent}
                    onChange={(e) => setSelectedEvent(e.target.value)}
                  >
                    <option value="">Select Event</option>
                    {events.map(event => (
                      <option key={event.id || event.event_id} value={event.id || event.event_id}>
                        {event.event_name || event.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Party Dropdown - For Distributor and Salesman (after order type selected) */}
              {shouldShowPartyDropdown() && (
                <div className="form-group">
                  <label htmlFor="party" className="form-label">Party</label>
                  <select
                    id="party"
                    className="summary-dropdown"
                    value={selectedParty}
                    onChange={(e) => setSelectedParty(e.target.value)}
                  >
                    <option value="">Select Party</option>
                    {parties.map(party => (
                      <option key={party.id || party.party_id} value={party.id || party.party_id}>
                        {party.party_name || party.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="summary-breakdown">
              <div className="breakdown-item">
                <span className="breakdown-label">Subtotal:</span>
                <span className="breakdown-value">
                  {formatPrice(calculateSubtotal())}
                </span>
              </div>
              <div className="breakdown-item total">
                <span className="breakdown-label">Total:</span>
                <span className="breakdown-value">
                  {formatPrice(calculateTotal())}
                </span>
              </div>
            </div>

            <button
              className="checkout-btn"
              onClick={handleCheckout}
              disabled={loading}
            >
              {loading ? 'PLACING ORDER...' : 'CHECKOUT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
