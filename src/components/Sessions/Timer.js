// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import React from "react";
import "antd/dist/antd.css";
import { Statistic } from "antd";
import "../../index.css";

const { Countdown } = Statistic;

function Timer(props) {
  const startTime = Date.parse(props.item.startTime);
  const createTime = Date.parse(props.item.createdAt);
  if (props.item.status === "scheduled") {
    return (
      <Countdown
        format={"H[h]:mm[m]:ss[s]"}
        // className="countdown"
        title="Elevated access starts in"
        value={startTime}
      />
    );
  } else if (props.item.status === "in progress") {
    const ends = new Date(startTime + props.item.duration * 60 * 60 * 1000);
    return (
      <Countdown
        format={"H[h]:mm[m]:ss[s]"}
        title="Elevated access ends in"
        value={ends}
      />
    );
  } else if (props.item.status === "pending") {
    const expires = new Date(createTime + 60 * 60 * 1000 * props.expiry);
    return (
      <Countdown
        format={"H[h]:mm[m]:ss[s]"}
        // className="countdown"
        title="request expires in"
        value={expires}
      />
    );
  } else return null;
}

export default Timer;
