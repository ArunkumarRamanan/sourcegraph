package db

var (
	AccessTokens              = &accessTokens{}
	ExternalServices          = &externalServices{}
	DiscussionThreads         = &discussionThreads{}
	DiscussionComments        = &discussionComments{}
	DiscussionMailReplyTokens = &discussionMailReplyTokens{}
	Repos                     = &repos{}
	Phabricator               = &phabricator{}
	SavedQueries              = &savedQueries{}
	Orgs                      = &orgs{}
	OrgMembers                = &orgMembers{}
	Settings                  = &settings{}
	Users                     = &users{}
	UserEmails                = &userEmails{}
	CertCache                 = &certCache{}

	SurveyResponses = &surveyResponses{}

	ExternalAccounts = &userExternalAccounts{}

	OrgInvitations = &orgInvitations{}

	// GlobalDeps is a stub implementation of a global dependency index
	GlobalDeps GlobalDepsProvider = &globalDeps{}

	// Pkgs is a stub implementation of a global package metadata index
	Pkgs PkgsProvider = &pkgs{}
)
