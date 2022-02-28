const query = `query HowMuchIsMyHomeWorthReviewQuery($zpid: ID!) {
    property(zpid: $zpid) {
      streetAddress

      state
      zipcode
      bedrooms
      bathrooms
      livingArea
      zestimate
      homeStatus
      photos(size: XL) {
        url
        __typename
      }
      ...OmpHomeWorthUpsell_property
      isConfirmedClaimedByCurrentSignedInUser
      isVerifiedClaimedByCurrentSignedInUser
      ...UARequiredPropertyDimensions_property
      ...ContactAgentForm_property
      ...HomeInfo_property
      __typename
    }
    viewer {
      ...ContactAgentForm_viewer
      __typename
    }
    abTests {
      ...OmpHomeWorthUpsell_abTests
      ...UARequiredPropertyDimensions_abTests
      ...ContactAgentForm_abTests
      __typename
    }
  }
  
  fragment OmpHomeWorthUpsell_property on Property {
    zpid
    onsiteMessage(placementNames: ["HMIMHWTopSlot"]) {
      ...onsiteMessage_fragment
      __typename
    }
    __typename
  }
  
  fragment onsiteMessage_fragment on OnsiteMessageResultType {
    eventId
    decisionContext
    messages {
      skipDisplayReason
      shouldDisplay
      isGlobalHoldout
      isPlacementHoldout
      placementName
      testPhase
      bucket
      placementId
      passThrottle
      lastModified
      eventId
      decisionContext
      selectedTreatment {
        id
        name
        component
        status
        renderingProps
        lastModified
        __typename
      }
      qualifiedTreatments {
        id
        name
        status
        lastModified
        __typename
      }
      __typename
    }
    __typename
  }
  
  fragment OmpHomeWorthUpsell_abTests on ABTests {
    HMIMHW_ZO_NFS_UPSELL_ONSITE_MESSAGING: abTest(trial: "HMIMHW_ZO_NFS_UPSELL_ONSITE_MESSAGING")
    __typename
  }
  
  fragment UARequiredPropertyDimensions_property on Property {
    currency
    featuredListingTypeDimension
    hasPublicVideo
    hdpTypeDimension
    listingTypeDimension
    price
    propertyTypeDimension
    standingOffer {
      isStandingOfferEligible
      __typename
    }
    zpid
    isZillowOwned
    zillowOfferMarket {
      legacyName
      __typename
    }
    ...ShouldShowVideo_property
    __typename
  }
  
  fragment ShouldShowVideo_property on Property {
    homeStatus
    isZillowOwned
    hasPublicVideo
    primaryPublicVideo {
      sources {
        src
        __typename
      }
      __typename
    }
    richMediaVideos {
      mp4Url
      hlsUrl
      __typename
    }
    __typename
  }
  
  fragment UARequiredPropertyDimensions_abTests on ABTests {
    ZO_HDP_HOUR_ONE_VIDEO: abTest(trial: "ZO_HDP_HOUR_ONE_VIDEO")
    __typename
  }
  
  fragment ContactAgentForm_property on Property {
    streetAddress
    state
    city
    zipcode
    zpid
    homeStatus
    homeType
    zestimate
    homeType
    isInstantOfferEnabled
    zillowOfferMarket {
      name
      code
      __typename
    }
    __typename
  }
  
  fragment ContactAgentForm_viewer on Viewer {
    name
    email
    zuid
    __typename
  }
  
  fragment ContactAgentForm_abTests on ABTests {
    SHOW_PL_LEAD_FORM: abTest(trial: "SHOW_PL_LEAD_FORM")
    __typename
  }
  
  fragment HomeInfo_property on Property {
    streetAddress
    city
    state
    zipcode
    bedrooms
    bathrooms
    livingArea
    homeStatus
    homeType
    contingentListingType
    photos(size: XL) {
      url
      __typename
    }
    listing_sub_type {
      is_newHome
      is_FSBO
      is_bankOwned
      is_foreclosure
      is_forAuction
      is_comingSoon
      __typename
    }
    __typename
  }
  `;

export default query;
