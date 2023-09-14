// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import { React, useState } from "react";
import Box from "@awsui/components-react/box";
import { useHistory } from "react-router-dom";
import Button from "@awsui/components-react/button";
import ColumnLayout from "@awsui/components-react/column-layout";
import Container from "@awsui/components-react/container";
import FormField from "@awsui/components-react/form-field";
import Grid from "@awsui/components-react/grid";
import SpaceBetween from "@awsui/components-react/space-between";
// import Link from "@awsui/components-react/link";
import Select from "@awsui/components-react/select";
import team from "../../media/team.png";
import "../../media/landing-page.css";

const selections = [
  { id: "1", label: "Create TEAM request" },
  { id: "2", label: "Approve TEAM request" },
];

function Landing(props) {
  const history = useHistory();
  const [selectedOption, setSelectedOption] = useState(selections[0]);
  return (
    <Box margin={{ bottom: "l" }}>
      <div className="custom-home__header">
        <Box
        // padding={{ vertical: "xxxl", horizontal: "xxxl" }}
        // margin={{ bottom: "xxl" }}
        >
          <Grid
            gridDefinition={[
              { offset: { l: 2, xxs: 1 }, colspan: { l: 8, xxs: 10 } },
              {
                colspan: { xl: 6, l: 5, s: 6, xxs: 10 },
                offset: { l: 2, xxs: 1 },
              },
              {
                colspan: { xl: 2, l: 3, s: 4, xxs: 10 },
                offset: { s: 0, xxs: 1 },
              },
            ]}
          >
            <Box fontWeight="light" padding={{ top: "xs" }}>
              <span className="custom-home__category">
                Identity &amp; Access Management
              </span>
            </Box>
            <div className="custom-home__header-title">
              <Box
                variant="h1"
                fontWeight="light"
                padding="n"
                fontSize="heading-xl"
                color="inherit"
              >
                IAM Identity Center
              </Box>
              <Box
                fontWeight="normal"
                padding={{ bottom: "s" }}
                fontSize="display-l"
                color="inherit"
              >
                Temporary Elevated Access Management
              </Box>
              <Box variant="p" fontWeight="light">
                <span className="custom-home__header-sub-title">
                  Temporary Elevated Access Management (TEAM) is an automated,
                  approval-based workflow for managing time-bound elevated
                  access to your AWS environment
                </span>
              </Box>
            </div>
            <div className="custom-home__header-cta">
              <Container margin={{ left: "xxl" }}>
                <SpaceBetween size="xl">
                  <Box variant="h2" padding="n">
                    TEAM Requests
                  </Box>
                  <FormField stretch={true} label="Actions">
                    <Select
                      selectedAriaLabel="Selected"
                      options={selections}
                      selectedOption={selectedOption}
                      ariaRequired={true}
                      onChange={(e) =>
                        setSelectedOption(e.detail.selectedOption)
                      }
                    />
                  </FormField>
                  <Button
                    href="#"
                    variant="primary"
                    onClick={() => {
                      if (selectedOption.id === "1") {
                        history.push("/requests/request");
                      } else if (selectedOption.id === "2") {
                        history.push("/approvals/approve");
                      }
                      props.setActiveHref("/sessions/active")
                    }}
                  >
                    Next steps
                  </Button>
                </SpaceBetween>
              </Container>
            </div>
          </Grid>
        </Box>
      </div>

      <Box padding={{ top: "xxxl", horizontal: "s" }}>
        <Grid
          gridDefinition={[
            {
              colspan: { xl: 6, l: 5, s: 6, xxs: 10 },
              // offset: { l: 2, xxs: 1 },
            },
            {
              colspan: { xl: 2, l: 3, s: 4, xxs: 10 },
              // offset: { s: 0, xxs: 1 },
            },
          ]}
        >
          <SpaceBetween size="xxl">
            <div>
              <Box
                variant="h1"
                tagOverride="h2"
                padding={{ bottom: "s", top: "n" }}
              >
                How it works
              </Box>
              <Container className="picbox">
                <div>
                  <img src={team} alt="team" className="pic" />
                </div>
              </Container>
            </div>

            <div>
              <Box
                variant="h1"
                tagOverride="h2"
                padding={{ bottom: "s", top: "n" }}
              >
                Benefits and features
              </Box>
              <Container>
                <ColumnLayout columns={2} variant="text-grid">
                  <div>
                    <Box variant="h3" padding={{ top: "n" }}>
                      Management console
                    </Box>
                    <Box variant="p">
                      Create, approve, monitor, and manage your TEAM request with
                      a few simple clicks on the management console.
                    </Box>
                  </div>
                  <div>
                    <Box variant="h3" padding={{ top: "n" }}>
                      Auditing
                    </Box>
                    <Box variant="p">
                      Session logs auditing enabling easy correlation of request
                      justification with session activity
                    </Box>
                  </div>
                  <div>
                    <Box variant="h3" padding={{ top: "n" }}>
                      Reporting
                    </Box>
                    <Box variant="p">
                      Centralised reporting of request and approval information
                    </Box>
                  </div>
                  <div>
                    <Box variant="h3" padding={{ top: "n" }}>
                      Enhanced security
                    </Box>
                    <Box variant="p">
                      Application single-sign-on with Cognito SAML integration
                      and group based authorization
                    </Box>
                  </div>
                </ColumnLayout>
              </Container>
            </div>
            {/* <div>
              <Box
                variant="h1"
                tagOverride="h2"
                padding={{ bottom: "s", top: "n" }}
              >
                Use cases
              </Box>
              <Container>
                <ColumnLayout columns={2} variant="text-grid">
                  <div>
                    <Box variant="h3" padding={{ top: "n" }}>
                      Configure multiple origins
                    </Box>
                    <Box variant="p">
                      Configure multiple origin servers and multiple cache
                      behaviors based on URL path patterns on your website. Use
                      AWS origins such as Amazon S3 or Elastic Load Balancing,
                      and add your own custom origins to the mix.
                    </Box>
                    <Link href="#">Learn more</Link>
                  </div>
                  <div>
                    <Box variant="h3" padding={{ top: "n" }}>
                      Deliver streaming video
                    </Box>
                    <Box variant="p">
                      Use CloudFront to deliver on-demand video without the need
                      to set up or operate any media servers. CloudFront
                      supports multiple protocols for media streaming.
                    </Box>
                    <Link href="#">Learn more</Link>
                  </div>
                </ColumnLayout>
              </Container>
            </div> */}
          </SpaceBetween>
        </Grid>
      </Box>
    </Box>
  );
}
export default Landing;
