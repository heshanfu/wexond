import React from 'react';

import { Content, StyledItem, Title } from './styles';

interface Props {
  title?: string;
}

export default class AboutItem extends React.Component<Props, {}> {
  public render() {
    const { title, children } = this.props;

    return (
      <StyledItem>
        <Title>{title}</Title>
        <Content>{children}</Content>
      </StyledItem>
    );
  }
}
